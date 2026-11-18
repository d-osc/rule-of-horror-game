import { synthesize } from './audio-synthesis';

// CPU-heavy synthesis runs outside the render and input thread.
self.onmessage = ({ data: sampleRate }: MessageEvent<number>) => {
  const result = synthesize(sampleRate);
  const arrays = [...result.noise, ...result.impulse, ...result.cues.flatMap((cue) => cue.channels)];
  self.postMessage(result, { transfer: arrays.map((channel) => channel.buffer) });
};
