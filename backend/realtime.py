import os
import json
import asyncio
import socketio
from vosk import Model, KaldiRecognizer

# ---- CONFIG ----
MODEL_PATH = os.path.join(os.path.dirname(__file__), "vosk-model-small-en-us-0.15")   # <<-- change this to your model folder name if different
SAMPLE_RATE = 16000.0

# ---- Load model once (startup) ----
if not os.path.isdir(MODEL_PATH):
    raise RuntimeError(f"Vosk model folder not found at '{MODEL_PATH}'. Put the extracted model there.")

model = Model(MODEL_PATH)

# ---- socket.io server ----
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=600
)

# Create ASGI app with specific socketio path that main.py mounts at /ws
sio_app = socketio.ASGIApp(sio, socketio_path="ws/socket.io")

# Per-sid state
# We'll keep a recognizer per-client and a small buffer
client_state = {}  # sid -> {"recognizer": KaldiRecognizer, "buffer": bytearray()}


# ---- helper to create recognizer ----
def make_recognizer():
    rec = KaldiRecognizer(model, SAMPLE_RATE)
    # Optionally set words=true to get word-level timings if model supports
    try:
        rec.SetWords(True)
    except Exception:
        pass
    return rec


# ---- socket events ----
@sio.event
async def connect(sid, environ):
    print("Socket connected:", sid)
    # init recognizer for this client
    client_state[sid] = {
        "recognizer": make_recognizer(),
        "buffer": bytearray(),
    }


@sio.event
async def disconnect(sid):
    print("Socket disconnected:", sid)
    client_state.pop(sid, None)


@sio.event
async def identify(sid, data):
    # client sends identify with user id — useful for logging or routing
    print("Identify event:", sid, data)
    # you could attach user_id to client_state if you want:
    if sid in client_state and isinstance(data, dict) and "user_id" in data:
        client_state[sid]["user_id"] = data["user_id"]


@sio.event
async def audio_chunk_pcm(sid, data):
    """
    Expecting `data` to be raw Int16 PCM bytes (16kHz mono).
    Vosk recognizer accepts bytes and returns JSON results.
    We'll emit partial results as they become available and final results when AcceptWaveform returns True.
    """
    try:
        state = client_state.get(sid)
        if state is None:
            # create on the fly (safety)
            state = {"recognizer": make_recognizer(), "buffer": bytearray()}
            client_state[sid] = state

        recognizer = state["recognizer"]

        # data may be bytes or memoryview; ensure bytes
        if isinstance(data, memoryview):
            chunk_bytes = data.tobytes()
        else:
            chunk_bytes = data

        # Feed chunk to recognizer
        is_final = recognizer.AcceptWaveform(chunk_bytes)
        if is_final:
            # final result (sentence)
            res = recognizer.Result()  # JSON string
            res_obj = json.loads(res)
            text = res_obj.get("text", "")
            # emit final transcript (is_final True)
            await sio.emit("live_transcript", {"text": text, "is_final": True}, to=sid)
            # reset recognizer to clear internal state for next utterance
            client_state[sid]["recognizer"] = make_recognizer()
        else:
            # partial result
            partial = recognizer.PartialResult()
            p_obj = json.loads(partial)
            # Vosk partial may contain "partial" key
            p_text = p_obj.get("partial", "")
            if p_text:
                await sio.emit("live_transcript", {"text": p_text, "is_final": False}, to=sid)

    except Exception as e:
        print("audio_chunk_pcm error:", e)
        # emit error to client optionally
        try:
            await sio.emit("live_feedback", {"error": "stt_error", "msg": str(e)}, to=sid)
        except Exception:
            pass
