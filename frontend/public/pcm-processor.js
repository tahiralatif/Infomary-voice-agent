// pcm-processor.js
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.sampleRate = 16000; // Fixed sample rate for consistency
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const float32Data = input[0]; // This is already Float32!

      // Add new data to buffer
      const newBuffer = new Float32Array(
        this.buffer.length + float32Data.length,
      );
      newBuffer.set(this.buffer);
      newBuffer.set(float32Data, this.buffer.length);
      this.buffer = newBuffer;

      // Process in 30ms frames (480 samples @ 16kHz)
      const frameSize = 480; // 16000 * 0.03 = 480 samples

      while (this.buffer.length >= frameSize) {
        // Extract one frame
        const frame = this.buffer.slice(0, frameSize);

        // IMPORTANT: Send Float32 directly to Speechmatics
        this.port.postMessage(
          {
            float32Data: frame.buffer, // Send Float32, not Int16
            sampleRate: this.sampleRate,
          },
          [frame.buffer], // Transfer ownership for efficiency
        );

        // Remove processed frame from buffer
        this.buffer = this.buffer.slice(frameSize);
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
