import { useRef } from "react";

function useAudioQueue() {
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferRef = useRef([]);
  const startTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  const MIN_BUFFER_SIZE = 16000 * 0.5;
  // Initialize AudioContext on user interaction
  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new window.AudioContext();
    }
    return audioCtxRef.current;
  };

  const playChunk = async (arrayBuffer) => {
    const ctx = initAudioContext();

    // Convert PCM16 to Float32
    const float32Data = convertPCM16ToFloat32(arrayBuffer);

    // Add to buffer
    bufferRef.current.push(...float32Data);

    // If not currently playing, start playback
    if (!isPlayingRef.current && bufferRef.current.length >= MIN_BUFFER_SIZE) {
      startPlayback(ctx);
    }
  };

  const startPlayback = (ctx) => {
    if (bufferRef.current.length === 0) return;

    isPlayingRef.current = true;

    const samplesToPlay = Math.min(bufferRef.current.length, 16000 * 2);
    // max 2 seconds of samples to play

    // Create audio buffer with current accumulated data
    const audioBuffer = ctx.createBuffer(1, samplesToPlay, 16000);
    audioBuffer.copyToChannel(
      new Float32Array(bufferRef.current.slice(0, samplesToPlay)),
      0
    );

    // Clear buffer for new data
    bufferRef.current = bufferRef.current.slice(samplesToPlay);

    // Create and configure source
    sourceRef.current = ctx.createBufferSource();
    sourceRef.current.buffer = audioBuffer;
    sourceRef.current.connect(ctx.destination);

    // Schedule playback
    if (startTimeRef.current === 0) {
      startTimeRef.current = ctx.currentTime;
    }

    sourceRef.current.start(startTimeRef.current);

    // Update next start time
    startTimeRef.current += audioBuffer.duration;

    // When this chunk ends, play the next accumulated data
    sourceRef.current.onended = () => {
      if (bufferRef.current.length >= MIN_BUFFER_SIZE) {
        // If we have more buffered data, play it
        startPlayback(ctx);
      } else {
        // No more data, reset
        isPlayingRef.current = false;
      }
    };
  };

  return { playChunk };
} // PCM converter helper
function convertPCM16ToFloat32(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const float32 = new Float32Array(arrayBuffer.byteLength / 2);
  for (let i = 0; i < float32.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 / 0x8000;
  }
  return float32;
}

export default useAudioQueue;
