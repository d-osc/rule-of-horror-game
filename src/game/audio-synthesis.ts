export type SynthesisResult = {
  noise: Float32Array[];
  impulse: Float32Array[];
  cues: { name: string; channels: Float32Array[] }[];
};

/** Pure CPU synthesis, shared by the worker (served builds) and the main thread (single-file build: file:// blocks every worker spawn). */
export function synthesize(sampleRate: number): SynthesisResult {
  const TAU = Math.PI * 2;
  const createBuffer = (channels: number, length: number, _rate?: number) => {
    const data = Array.from({ length: channels }, () => new Float32Array(Math.ceil(length)));
    return { data, getChannelData: (channel: number) => data[channel] };
  };
  type Samples = ReturnType<typeof createBuffer>;
  const noiseBuffer = createBuffer(1, sampleRate * 5);
  const impulse = createBuffer(2, Math.floor(sampleRate * 1.38));
  const buffers = new Map<string, Samples>();
  const ctx = { createBuffer };
  const rate = sampleRate;
  let seed = 44909;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  const noise = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = random() * .75;
  // Taper both sides of the periodic bed so its loop boundary is quiet.
  for (let i = 0; i < rate * .025; i++) {
    const fade = i / (rate * .025);
    noise[i] *= fade; noise[noise.length - 1 - i] *= fade;
  }
  for (let channel = 0; channel < 2; channel++) {
    const out = impulse.getChannelData(channel);
    let previous = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / rate;
      previous = previous * .55 + random() * .45;
      out[i] = previous * Math.exp(-t * 5.5) * (t < .017 ? 0 : .32);
    }
    // Unequal early reflections describe tiled walls without a large washed-out cathedral tail.
    for (const [delay, amplitude] of [[.026 + channel * .004, .45], [.057 - channel * .006, .27], [.092 + channel * .009, .17]]) {
      const index = Math.floor(delay * rate);
      out[index] += amplitude;
    }
  }
  const make = (name: string, duration: number, sample: (t: number, n: number) => number) => {
    const buffer = ctx.createBuffer(1, Math.ceil(rate * duration), rate);
    const data = buffer.getChannelData(0);
    let peak = .001;
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      const fade = Math.min(1, t / .002, (duration - t) / .025);
      data[i] = sample(t, random()) * Math.max(0, fade);
      peak = Math.max(peak, Math.abs(data[i]));
    }
    const scale = .85 / peak;
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    buffers.set(name, buffer);
  };
  const modal = (t: number, f: number, decay: number) => Math.sin(TAU * f * t) * Math.exp(-t * decay);
  let colored = 0;
  for (const variant of [0, 1]) {
    colored = 0;
    make(`footstep${variant}`, .38, (t, n) => {
      colored = colored * .72 + n * .28;
      const heel = Math.sin(TAU * (92 * t - 48 * t * t)) * Math.exp(-t * 32);
      const sole = colored * Math.exp(-t * 23) * .7;
      const tile = modal(t, 1280 + variant * 97, 76) * .09 + modal(t, 2370, 95) * .035;
      const toeTime = Math.max(0, t - .065);
      return heel * .64 + sole + tile + (t > .065 ? colored * Math.exp(-toeTime * 47) * .25 : 0);
    });
  }
  make('knock', .65, (t, n) => modal(t, 104, 17) * .8 + modal(t, 181, 28) * .4 + modal(t, 293, 36) * .2 + n * Math.exp(-t * 180) * .7);
  make('horn', .44, (t) => {
    const envelope = Math.min(1, t / .035, Math.max(0, (.4 - t) / .09));
    return envelope * (Math.sin(TAU * 392 * t) + .7 * Math.sin(TAU * 466 * t) + .32 * Math.sin(TAU * 784 * t));
  });
  make('interact', .32, (t, n) => {
    const latch = modal(t, 1780, 62) * .14 + modal(t, 3067, 98) * .08;
    const click2 = t > .041 ? n * Math.exp(-(t - .041) * 240) * .26 : 0;
    return n * Math.exp(-t * 220) * .65 + modal(t, 235, 45) * .35 + latch + click2;
  });
  make('step', .67, (t, n) => n * Math.exp(-t * 125) * .4 + modal(t, 163, 20) * .5 + modal(t, 437, 37) * .15 + modal(t, 1193, 68) * .045);
  colored = 0;
  make('whisper', 2.65, (t, n) => {
    colored = colored * .8 + n * .2;
    const breath = Math.pow(Math.sin(Math.PI * t / 2.65), 2);
    const syllables = .35 + .65 * Math.pow(Math.sin(t * 7.3 + .4), 2);
    const hiss = n - colored;
    return hiss * breath * syllables * (.6 + .4 * Math.sin(TAU * 780 * t)) + colored * breath * .15;
  });
  // Jump-scare sting: a razor screech gliding upward with a scraping rasp,
  // over a faint beating metal bed.
  make('danger', 3.15, (t, n) => {
    const swell = Math.sin(Math.PI * t / 3.15) ** 1.5;
    const phase = (f: number) => TAU * f * (t + .14 * t * t);
    const shriek = Math.sin(phase(817)) * .3 + Math.sin(phase(825) + 1.1) * .22 + Math.sin(phase(1243) + .6) * .15 + Math.sin(phase(1657)) * .1 + Math.sin(phase(2411) + 2.2) * .05;
    const tremble = .58 + .42 * Math.sin(t * 52) ** 2;
    const rasp = n * .16 * (.5 + .5 * Math.sin(t * 88) ** 3);
    const bed = Math.sin(TAU * 94.1 * t) * .14 + Math.sin(TAU * 96.7 * t) * .1;
    return swell * ((shriek + rasp) * tremble + bed);
  });
  colored = 0;
  make('fail', 2.7, (t, n) => {
    colored = colored * .86 + n * .14;
    const impact = Math.sin(TAU * (81 * t - 8 * t * t)) * Math.exp(-t * 6);
    const scrape = (n - colored) * Math.exp(-t * 3) * (.25 + .2 * Math.sin(t * 54) ** 2);
    return impact * .7 + scrape + modal(t, 287.3, 2.4) * .12 + modal(t, 294.1, 2.7) * .12;
  });
  colored = 0;
  make('win', 2.7, (t, n) => {
    colored = colored * .93 + n * .07;
    const exhale = Math.sin(Math.PI * t / 2.7) ** 2 * Math.exp(-t * .8);
    return colored * exhale + modal(t, 152, 12) * .08 + n * Math.exp(-t * 100) * .12;
  });
  return {
    noise: noiseBuffer.data,
    impulse: impulse.data,
    cues: [...buffers].map(([name, buffer]) => ({ name, channels: buffer.data })),
  };
}
