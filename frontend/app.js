// app.js — real-time streaming to backend via Socket.IO
// Requires: <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script> in the HTML

const SERVER_URL = "http://localhost:8000"; // change if your backend is elsewhere
const micBtn = document.getElementById("micButton");

let audioContext;
let processor;
let source;
let socket;
let isRecording = false;

// chunk size controls how often we send audio — 4096 is typical
const BUFFER_SIZE = 4096;
const INPUT_SAMPLE_RATE = 48000; // most browsers use 48kHz; will be detected and handled
const TARGET_SAMPLE_RATE = 16000; // vosk expects 16k

// helper: convert Float32 [-1..1] buffer to Int16 PCM (Little Endian) ArrayBuffer
function floatTo16BitPCM(float32Array) {
  const len = float32Array.length;
  const buffer = new ArrayBuffer(len * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < len; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// helper: downsample float32 buffer from srcRate to targetRate (linear interpolation)
function downsampleBuffer(buffer, srcRate, targetRate) {
  if (targetRate === srcRate) return buffer;
  const sampleRateRatio = srcRate / targetRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    // simple average to avoid aliasing (you can do linear interpolation to be more precise)
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

async function startMic() {
  try {
    // connect socket if not connected
    if (!socket || socket.disconnected) {
      socket = io(SERVER_URL, { transports: ["websocket"] });
      socket.on("connect", () => console.log("Socket connected:", socket.id));
      socket.on("disconnect", () => console.log("Socket disconnected"));
      socket.on("transcript_partial", (d) => console.log("partial:", d));
      socket.on("transcript_final", (d) => console.log("final:", d));
      socket.on("analysis_result", (d) => {
        console.log("analysis_result:", d);
        // TODO: update UI with d.analysis, d.suggestions
      });
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // create a processor to access raw audio
    processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    // create source from microphone
    source = audioContext.createMediaStreamSource(stream);
    source.connect(processor);
    processor.connect(audioContext.destination); // required in some browsers

    // detect actual sample rate (use AudioContext.sampleRate)
    const srcSampleRate = audioContext.sampleRate || INPUT_SAMPLE_RATE;
    console.log("AudioContext sampleRate:", srcSampleRate);

    processor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0); // Float32Array
      // downsample to 16k
      const downsampled = downsampleBuffer(inputBuffer, srcSampleRate, TARGET_SAMPLE_RATE);
      // convert to 16-bit PCM
      const pcm16Buffer = floatTo16BitPCM(downsampled);
      // send as binary to server via socket.io
      if (socket && socket.connected) {
        socket.emit("audio_stream", pcm16Buffer);
      }
    };

    // update UI
    isRecording = true;
    micBtn.classList.add("bg-red-500");
    micBtn.innerHTML = `<span class="material-icons-outlined" style="font-size:32px">stop</span>`;

  } catch (err) {
    console.error("startMic error:", err);
    alert("Microphone access denied or not available.");
  }
}

function stopMic() {
  // stop audio processing
  try {
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
      processor = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  } catch (e) {
    console.warn("error stopping audio nodes", e);
  }

  // notify server finalization
  if (socket && socket.connected) {
    socket.emit("end_stream");
  }

  isRecording = false;
  micBtn.classList.remove("bg-red-500");
  micBtn.innerHTML = `<span class="material-icons-outlined" style="font-size:32px">mic</span>`;
}

micBtn.addEventListener("click", async () => {
  if (!isRecording) {
    await startMic();
  } else {
    stopMic();
  }
});
