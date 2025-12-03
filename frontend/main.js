// main.js — Fully functional real-time mic engine (live decibel meter, live WPM,
// filler detection, streaming audio chunks to backend via Socket.IO, final upload).
//
// Assumptions:
// - Your HTML contains elements with IDs: micButton, decibelBar, timerDisplay, suggestionText, userImage, userName
// - Socket.IO server is available at SOCKET_URL (change if needed).
// - A REST endpoint exists at /create-session to record final session metadata.
// - A REST endpoint exists at /upload-audio to accept final audio Blob (optional).
//
// Behavior summary:
// - Click mic button to start streaming audio (real-time).
// - While live: decibel bar updates, audio chunks are sent to server via Socket.IO.
// - Server may emit "live_transcript" and "live_feedback" events — handled below.
// - On stop: MediaRecorder final blob is uploaded (if upload endpoint exists), then /create-session is called.
//cd "C:\Users\zaira\OneDrive\Desktop\Desktop Folder\Verbalystic\backend"
//.\venv\Scripts\activate
//uvicorn main:app --reload --port 8000

console.log("Main.js (real-time) loaded");

// ---------- CONFIG ----------

const USER_ID = "c7c92dad-80b2-42ed-b1c1-beb25ec18d07"; // keep from your app
const SOCKET_URL = "http://127.0.0.1:8000";
const UPLOAD_AUDIO_URL = "http://127.0.0.1:8000/upload-audio";
const CREATE_SESSION_URL = "http://127.0.0.1:8000/create-session";


const FILLER_WORDS = ["um", "uh", "like", "you know", "so", "actually", "basically", "right"];

// ---------- STATE ----------
let isRecording = false;
let audioContext = null;
let mediaStream = null;
let processorNode = null;
let sourceNode = null;
let socket = null;
let mediaRecorder = null;
let recordedChunks = [];
let sessionStartTs = null;
let totalWordsCount = 0;
let lastTranscript = "";
let liveWpm = 0;
let liveFillerCount = 0;
let decibelSmoothing = 0.85; // smoothing factor for decibel display

// UI elements
const micButton = document.getElementById("micButton");
const decibelBar = document.getElementById("decibelBar");
const timerDisplay = document.getElementById("timerDisplay");
const suggestionText = document.getElementById("suggestionText");

// ensure socket.io client exists; if not, load CDN dynamically

async function ensureSocketIoClient() {
    if (typeof io !== "undefined") return;
    await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.socket.io/4.7.2/socket.io.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load socket.io client"));
        document.head.appendChild(s);
    });
}

// ---------- UTIL: Float32 -> Int16 ----------
function floatTo16BitPCM(float32Array) {
    const l = float32Array.length;
    const buffer = new ArrayBuffer(l * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < l; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
}

// Downsample Float32Array to 16000 Hz (if needed)
function downsampleBuffer(buffer, inputSampleRate, outSampleRate) {
    if (outSampleRate === inputSampleRate) return buffer;
    if (outSampleRate > inputSampleRate) {
        console.warn("downsampleBuffer: outSampleRate should be <= inputSampleRate");
        return buffer;
    }
    const sampleRateRatio = inputSampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        // use average value between the two offsets
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = Math.max(-1, Math.min(1, accum / count)) * 0x7fff;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result.buffer;
}

// ---------- UI helpers ----------
function setMicActiveUI(active) {
    if (active) {
        micButton.classList.add("bg-blue-700");
        micButton.classList.remove("bg-primary");
    } else {
        micButton.classList.remove("bg-blue-700");
        micButton.classList.add("bg-primary");
    }
}

function updateTimer() {
    if (!isRecording || !sessionStartTs) {
        timerDisplay.innerText = "00:00";
        return;
    }
    const elapsed = Math.floor((Date.now() - sessionStartTs) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    timerDisplay.innerText = `${mm}:${ss}`;
}

// decibel is expected around -60 to 0 for RMS. We'll map to 0-100% height.
let smoothedDbPercent = 0;
function updateDecibelBar(rms) {
    // rms is between 0 and maybe ~0.5 depending on input.
    // convert to dBFS
    let db;
    if (rms <= 1e-8) db = -100;
    else db = 20 * Math.log10(rms);
    // map -100..0 to 0..100
    let pct = (db + 100) / 100;
    pct = Math.max(0, Math.min(1, pct));
    // smooth
    smoothedDbPercent = smoothedDbPercent * decibelSmoothing + pct * (1 - decibelSmoothing);
    decibelBar.style.height = `${Math.round(smoothedDbPercent * 100)}%`;
}

// set suggestion text safely
function updateSuggestionText(text) {
    suggestionText.innerText = text;
}

// ---------- SOCKET: init, handlers ----------
async function initSocket() {
    await ensureSocketIoClient();

    // create socket connected to the FastAPI mount at /ws
    
    socket = io(SOCKET_URL, {
        path: "/ws/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: false
    });




    socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        socket.emit("identify", { user_id: USER_ID });
    });

    socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
    });

    socket.on("live_transcript", (payload) => {
        lastTranscript = payload.text || "";
        computeLocalStatsFromTranscript(lastTranscript);
    });

    socket.on("live_feedback", (payload) => {
        if (!payload) return;
        if (payload.suggestion) updateSuggestionText(payload.suggestion);
        if (payload.wpm !== undefined) {
            liveWpm = Math.round(payload.wpm);
            updateSuggestionText(`${payload.suggestion || ""}  •  WPM: ${liveWpm}  •  Fillers: ${payload.fillerCount || 0}`);
        }
    });

    socket.on("error", (err) => {
        console.error("Socket error:", err);
    });
}

// ---------- LOCAL ANALYSIS (fallback) ----------
function computeLocalStatsFromTranscript(transcript) {
    if (!transcript) return;
    const words = transcript.trim().split(/\s+/).filter(Boolean);
    totalWordsCount = words.length;
    // estimate WPM using elapsed time
    if (sessionStartTs) {
        const elapsedMinutes = (Date.now() - sessionStartTs) / 1000 / 60;
        const estimatedWpm = elapsedMinutes > 0 ? totalWordsCount / elapsedMinutes : 0;
        liveWpm = Math.round(estimatedWpm);
    }
    // simple filler detection
    let foundFillers = 0;
    const lower = transcript.toLowerCase();
    for (const f of FILLER_WORDS) {
        // count occurrences with word boundaries
        const re = new RegExp("\\b" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi");
        const match = lower.match(re);
        if (match) foundFillers += match.length;
    }
    liveFillerCount = foundFillers;

    // create suggestion heuristic
    let suggestion = "";
    if (liveWpm < 90) suggestion = "Try speaking a bit faster.";
    else if (liveFillerCount > 2) suggestion = "Reduce filler words (um/uh/like).";
    else suggestion = "Good pace — keep going.";

    updateSuggestionText(`${suggestion} • WPM: ${liveWpm} • Fillers: ${liveFillerCount}`);
}

// ---------- RECORDING / STREAMING ----------
async function startRecording() {
    if (isRecording) return;
    try {
        await initSocket(); // ensure socket ready
    } catch (err) {
        console.error("Socket init failed:", err);
        alert("Failed to connect to realtime server. Check SOCKET_URL.");
        return;
    }

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        console.error("Microphone access error:", err);
        alert("Please grant microphone access.");
        return;
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // For compatibility, use ScriptProcessor if AudioWorklet not available.
    // buffer size 4096 gives decent latency.
    const bufferSize = 4096;
    processorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

    // MediaRecorder used to capture final audio file
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start(1000); // timeslice for ondataavailable (1s)

    // connect nodes
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    // start session timing
    sessionStartTs = Date.now();
    isRecording = true;
    setMicActiveUI(true);
    updateSuggestionText("Recording...");

    // send an event to server that session started
    if (socket && socket.connected) {
        socket.emit("session_start", { user_id: USER_ID, ts: sessionStartTs });
    }

    // process audio frames
    processorNode.onaudioprocess = (e) => {
        if (!isRecording) return;
        const inputBuffer = e.inputBuffer.getChannelData(0);
        // compute RMS for decibel display
        let rms = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
            rms += inputBuffer[i] * inputBuffer[i];
        }
        rms = Math.sqrt(rms / inputBuffer.length);
        updateDecibelBar(rms);

        // downsample to 16k and convert to Int16 PCM
        const float32 = inputBuffer;
        // If your audioContext.sampleRate != 16000, downsample.
        const sampleRate = audioContext.sampleRate;
        // Convert to Float32Array copy to avoid modifying the original
        const float32copy = new Float32Array(float32.length);
        float32copy.set(float32);

        let bufferToSend;
        if (sampleRate !== 16000) {
            // naive downsample: this helper returns an ArrayBuffer of Int16
            const down = downsampleBuffer(float32copy, sampleRate, 16000);
            bufferToSend = down; // already Int16 ArrayBuffer
        } else {
            bufferToSend = floatTo16BitPCM(float32copy);
        }

        // Send chunk to socket.io as binary
        if (socket && socket.connected) {
            try {
                // mark chunk with a tiny meta header if needed
                socket.emit("audio_chunk_pcm", bufferToSend);
            } catch (err) {
                console.error("Socket emit chunk error:", err);
            }
        }
    };

    // update short timer every 500ms
    const timerInterval = setInterval(() => {
        if (!isRecording) {
            clearInterval(timerInterval);
            return;
        }
        updateTimer();
    }, 500);
}

async function stopRecording() {
    if (!isRecording) return;

    isRecording = false;
    setMicActiveUI(false);
    updateSuggestionText("Processing final data...");

    // stop nodes and stream
    if (processorNode) {
        processorNode.disconnect();
        processorNode.onaudioprocess = null;
        processorNode = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioContext) {
        try { audioContext.close(); } catch (e) { /* ignore */ }
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
    }

    // stop mediaRecorder and wait for final chunks
    const stopPromise = new Promise((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
    });

    await stopPromise;

    // final duration
    const durationSeconds = Math.max(0, Math.floor((Date.now() - sessionStartTs) / 1000));

    // prepare audio blob from recordedChunks
    let audioBlob = null;
    try {
        audioBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "audio/webm" });
    } catch (e) {
        console.warn("Failed to assemble final audio blob:", e);
    }

    // Attempt to upload audioBlob if endpoint exists. If it fails, we still call create-session with no audio_url.
    let audioUrl = null;
    if (audioBlob) {
        try {
            const form = new FormData();
            // filename with timestamp
            const filename = `session_${USER_ID}_${Date.now()}.webm`;
            form.append("file", audioBlob, filename);
            // add user id for association
            form.append("user_id", USER_ID);

            const res = await fetch(UPLOAD_AUDIO_URL, {
                method: "POST",
                body: form
            });

            if (res.ok) {
                const j = await res.json();
                // assume server returns { url: "https://..." }
                audioUrl = j.url || j.audio_url || null;
                console.log("Audio uploaded:", audioUrl);
            } else {
                console.warn("Audio upload failed:", res.statusText);
            }
        } catch (err) {
            console.warn("Audio upload error:", err);
        }
    }

    // final stats — prefer server-provided stats if available; otherwise use local estimates
    const payload = {
        user_id: USER_ID,
        audio_url: audioUrl,
        transcript: lastTranscript || null,
        duration_seconds: durationSeconds,
        avg_wpm: liveWpm || null,
        filler_word_count: liveFillerCount || null,
        pronunciation_score: null, // filled by backend analysis if available
        tone_score: null,
        grammar_score: null
    };

    // inform server that session ended
    if (socket && socket.connected) {
        try {
            socket.emit("session_end", { user_id: USER_ID, duration_seconds: durationSeconds });
        } catch (e) {
            console.warn("session_end emit failed:", e);
        }
    }

    // call create-session endpoint
    try {
        const res = await fetch(CREATE_SESSION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const j = await res.json();
            console.log("Session saved:", j);
            updateSuggestionText("Session saved. " + (j.message || ""));
            alert("Session saved successfully!");
        } else {
            const txt = await res.text();
            console.error("create-session failed:", res.status, txt);
            alert("Failed to save session (create-session). Check console.");
            updateSuggestionText("Failed to save session.");
        }
    } catch (err) {
        console.error("create-session error:", err);
        alert("Failed to save session (network error).");
        updateSuggestionText("Failed to save session.");
    }

    // disconnect socket optionally
    if (socket) {
        try { socket.disconnect(); } catch (e) { /* ignore */ }
        socket = null;
    }

    // reset session variables
    recordedChunks = [];
    sessionStartTs = null;
    totalWordsCount = 0;
    lastTranscript = "";
    liveWpm = 0;
    liveFillerCount = 0;
    updateTimer();
}

// ---------- MIC BUTTON HANDLER ----------
micButton.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            await startRecording();
        } catch (err) {
            console.error("startRecording error:", err);
            alert("Failed to start recording. See console.");
        }
    } else {
        try {
            await stopRecording();
        } catch (err) {
            console.error("stopRecording error:", err);
            alert("Failed to stop recording. See console.");
        }
    }
});

// ---------- safety: stop and cleanup when page unloads ----------
window.addEventListener("beforeunload", () => {
    if (isRecording) {
        try {
            stopRecording();
        } catch (e) { /* ignore */ }
    }
});

// ---------- Initialization ----------
(function init() {
    // Set initial UI
    setMicActiveUI(false);
    updateTimer();
    updateSuggestionText("Click the mic to start a session.");

    // Pre-init socket lazily to avoid blocking
    // NOTE: we will init when recording starts, but you can init earlier by uncommenting:
    // initSocket().catch(e => console.warn("Socket pre-init failed:", e));
})();
