import os
import json
import socketio
from vosk import Model, KaldiRecognizer

# ---- CONFIG ----
MODEL_PATH = os.path.join(os.path.dirname(__file__), "vosk-model-small-en-us-0.15")   # <<-- change this to your model folder name if different
SAMPLE_RATE = 16000.0
DEFAULT_SOCKET_ORIGINS = [
    "https://verbalystic-nu.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]


def parse_socket_origins():
    raw = os.getenv("SOCKET_IO_ALLOWED_ORIGINS") or os.getenv("CORS_ALLOWED_ORIGINS")
    if not raw:
        return DEFAULT_SOCKET_ORIGINS
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]

# ---- Load model once (startup) ----
if not os.path.isdir(MODEL_PATH):
    raise RuntimeError(f"Vosk model folder not found at '{MODEL_PATH}'. Put the extracted model there.")

model = Model(MODEL_PATH)

# ---- socket.io server ----
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=parse_socket_origins(),
    ping_timeout=600
)

# Create ASGI app with specific socketio path that main.py mounts at /ws
sio_app = socketio.ASGIApp(sio, socketio_path="ws/socket.io")

# Per-sid state. Keep one recognizer alive for the whole recording session and
# accumulate final Vosk segments separately from the current partial segment.
client_state = {}


# ---- helper to create recognizer ----
def make_recognizer():
    rec = KaldiRecognizer(model, SAMPLE_RATE)
    # Optionally set words=true to get word-level timings if model supports
    try:
        rec.SetWords(True)
    except Exception:
        pass
    return rec


def make_state():
    return {
        "recognizer": make_recognizer(),
        "final_segments": [],
        "partial": "",
        "user_id": None,
    }


def get_state(sid):
    state = client_state.get(sid)
    if state is None:
        state = make_state()
        client_state[sid] = state
    return state


def append_final_segment(state, text):
    text = (text or "").strip()
    if text:
        state["final_segments"].append(text)
    state["partial"] = ""
    return " ".join(state["final_segments"]).strip()


# ---- socket events ----
@sio.event
async def connect(sid, environ):
    print("Socket connected:", sid)
    client_state[sid] = make_state()


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
async def session_start(sid, data):
    state = make_state()
    if isinstance(data, dict):
        state["user_id"] = data.get("user_id")
    client_state[sid] = state
    print("Session started:", sid, state.get("user_id"))
    return {"ok": True}


@sio.event
async def audio_chunk_pcm(sid, data):
    """
    Expecting `data` to be raw Int16 PCM bytes (16kHz mono).
    Vosk recognizer accepts bytes and returns JSON results.
    We'll emit partial results as they become available and final results when AcceptWaveform returns True.
    """
    try:
        state = get_state(sid)
        recognizer = state["recognizer"]

        # data may be bytes or memoryview; ensure bytes
        if isinstance(data, memoryview):
            chunk_bytes = data.tobytes()
        else:
            chunk_bytes = data

        if not chunk_bytes:
            return

        # Feed chunk to recognizer
        is_final = recognizer.AcceptWaveform(chunk_bytes)
        if is_final:
            res = recognizer.Result()  # JSON string
            res_obj = json.loads(res)
            text = res_obj.get("text", "")
            transcript = append_final_segment(state, text)
            await sio.emit(
                "live_transcript",
                {
                    "text": text,
                    "transcript": transcript,
                    "is_final": True,
                },
                to=sid,
            )
        else:
            partial = recognizer.PartialResult()
            p_obj = json.loads(partial)
            p_text = p_obj.get("partial", "")
            state["partial"] = p_text
            transcript = " ".join(
                part for part in [" ".join(state["final_segments"]), p_text] if part
            ).strip()
            await sio.emit(
                "live_transcript",
                {
                    "text": p_text,
                    "transcript": transcript,
                    "is_final": False,
                },
                to=sid,
            )

    except Exception as e:
        print("audio_chunk_pcm error:", e)
        # emit error to client optionally
        try:
            await sio.emit("live_feedback", {"error": "stt_error", "msg": str(e)}, to=sid)
        except Exception:
            pass


@sio.event
async def session_end(sid, data):
    try:
        state = get_state(sid)
        recognizer = state["recognizer"]
        res_obj = json.loads(recognizer.FinalResult())
        text = res_obj.get("text", "")
        transcript = append_final_segment(state, text)

        await sio.emit(
            "live_transcript",
            {
                "text": text,
                "transcript": transcript,
                "is_final": True,
                "is_session_end": True,
            },
            to=sid,
        )

        return {"ok": True, "transcript": transcript}

    except Exception as e:
        print("session_end error:", e)
        return {"ok": False, "error": str(e)}
