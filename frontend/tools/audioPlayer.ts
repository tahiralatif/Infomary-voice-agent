// Continuous scheduled PCM s16le playback
let playbackCtx: AudioContext | null = null
let nextPlayTime = 0

export function playChunk(chunk: ArrayBuffer) {
  if (!playbackCtx) {
    playbackCtx = new AudioContext()
  }
  const ctx = playbackCtx

  const int16 = new Int16Array(chunk)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0
  }

  const buffer = ctx.createBuffer(1, float32.length, 16000)
  buffer.copyToChannel(float32, 0)

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)

  const now = ctx.currentTime
  const startTime = nextPlayTime < now ? now : nextPlayTime
  source.start(startTime)
  nextPlayTime = startTime + buffer.duration
}

export function resetPlayback() {
  nextPlayTime = playbackCtx?.currentTime ?? 0
}

export function closePlayback() {
  playbackCtx?.close()
  playbackCtx = null
  nextPlayTime = 0
}
