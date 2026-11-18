export type AudioCue = 'step' | 'knock' | 'whisper' | 'danger' | 'fail' | 'win' | 'interact' | 'footstep' | 'screech' | 'horn';
import { synthesize, type SynthesisResult } from './audio-synthesis';
import { assetUrl } from './fileAssets';

type Voice = { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode };


/** Synthesized ambience and effects with bundled recordings for speech and the death screech. */
export class HorrorAudio {
  unlocked = false;
  muted = false;
  private ctx?: AudioContext;
  private master?: GainNode;
  private dry?: GainNode;
  private send?: GainNode;
  private convolver?: ConvolverNode;
  private wet?: GainNode;
  private impulse?: AudioBuffer;
  private waterGain?: GainNode;
  private active = false;
  private water = false;
  private loops: AudioScheduledSourceNode[] = [];
  private loopNodes: AudioNode[] = [];
  private voices = new Set<Voice>();
  private speech?: Voice;
  private speechRequest = 0;
  private speechBuffers = new Map<string, Promise<AudioBuffer | undefined>>();
  private cooldown = new Map<AudioCue, number>();
  private buffers = new Map<string, AudioBuffer>();
  private screechFetch?: Promise<ArrayBuffer>;
  private screechReady = false;

  /** Sampled death screech (user-supplied clip, public/audio/screech.mp3); falls back to the synthesized sting. */
  async loadScreech(): Promise<void> {
    if (this.screechReady || !this.ctx) return;
    try {
      this.screechFetch ??= fetch(assetUrl('audio/screech.mp3')).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      });
      const decoded = await this.ctx.decodeAudioData(await this.screechFetch);
      const data = decoded.getChannelData(0);
      let peak = 1e-4;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
      const scale = .85 / peak;
      const fadeIn = Math.floor(decoded.sampleRate * .012);
      const fadeOut = Math.floor(decoded.sampleRate * .09);
      for (let i = 0; i < data.length; i++) {
        let g = scale;
        if (i < fadeIn) g *= i / fadeIn;
        const tail = data.length - i;
        if (tail < fadeOut) g *= tail / fadeOut;
        data[i] *= g;
      }
      this.buffers.set('screech', decoded);
      this.screechReady = true;
    } catch { /* Missing or undecodable clip: keep the synthesized sting. */ }
  }
  private noiseBuffer?: AudioBuffer;
  private sequence = 0;

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .42;
      this.master.connect(this.ctx.destination);
      void this.prepareTextures();
    }
    void this.loadScreech();
    const ctx = this.ctx;
    if (ctx.state === 'suspended') await ctx.resume();
    await this.prepareTextures();
    if (this.ctx !== ctx) return;
    this.unlocked = ctx.state === 'running';
    if (this.active && !this.loops.length) this.startLoops();
  }

  /** Durations of sources still sounding; used by QA checks to confirm a cue survived. */
  get playingDurations(): number[] {
    return [...this.voices].map((v) => v.source.buffer?.duration ?? 0);
  }

  get speechPlaying(): boolean {
    return this.speech !== undefined;
  }

  preloadSpeech(urls: readonly string[]): void {
    if (!this.ctx) return;
    for (const url of urls) void this.loadSpeech(this.ctx, url);
  }

  private loadSpeech(ctx: AudioContext, url: string): Promise<AudioBuffer | undefined> {
    let pending = this.speechBuffers.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error('Dialogue unavailable');
          return response.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          this.speechBuffers.delete(url);
          return undefined;
        });
      this.speechBuffers.set(url, pending);
    }
    return pending;
  }

  async speak(url: string, { pan = 0, eerie = false } = {}): Promise<void> {
    this.stopSpeech();
    const request = this.speechRequest;
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const buffer = await this.loadSpeech(ctx, url);
    await this.prepareTextures();
    if (!buffer || request !== this.speechRequest || !this.unlocked || this.muted) return;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const stereo = ctx.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = eerie ? 0.9 : 1;
    gain.gain.value = eerie ? 0.82 : 0.94;
    stereo.pan.value = pan;
    source.connect(gain).connect(stereo);
    if (eerie) {
      this.room();
      this.route(stereo);
    } else stereo.connect(this.master!);
    this.speech = { source, gain, pan: stereo };
    source.onended = () => {
      this.speech = undefined;
      source.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
    source.start();
  }

  stopSpeech(): void {
    this.speechRequest++;
    if (!this.speech) return;
    const { source, gain, pan } = this.speech;
    this.speech = undefined;
    source.onended = null;
    source.stop();
    source.disconnect();
    gain.disconnect();
    pan.disconnect();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : .42, this.ctx.currentTime, .025);
  }

  setActive(active: boolean): void {
    if (active === this.active) {
      // A menu/quit request must also cancel a stinger created after gameplay ended.
      if (!active) this.stopSources();
      return;
    }
    this.active = active;
    this.stopSources();
    if (active) {
      this.cooldown.clear();
      if (this.unlocked) this.startLoops();
    }
  }

  setWater(on: boolean): void {
    this.water = on;
    if (this.ctx && this.waterGain) this.waterGain.gain.setTargetAtTime(on ? .19 : 0, this.ctx.currentTime, .3);
  }

  /** One small stereo room shared by all sources; disconnecting it clears the old scene's tail. */
  private room(): void {
    if (!this.ctx || !this.master || this.dry) return;
    const ctx = this.ctx;
    this.dry = ctx.createGain(); this.dry.gain.value = .88;
    this.dry.connect(this.master);
    this.send = ctx.createGain(); this.send.gain.value = .26;
    this.convolver = ctx.createConvolver(); this.convolver.buffer = this.impulse!;
    this.wet = ctx.createGain(); this.wet.gain.value = .32;
    this.send.connect(this.convolver).connect(this.wet).connect(this.master);
  }

  private route(node: AudioNode): void {
    node.connect(this.dry!);
    node.connect(this.send!);
  }

  private startLoops(): void {
    if (!this.ctx || !this.noiseBuffer || this.loops.length) return;
    this.room();
    const ctx = this.ctx;
    const hum = ctx.createGain(); hum.gain.value = .075;
    this.route(hum);
    const low = ctx.createOscillator(); low.frequency.value = 49.8;
    const near = ctx.createOscillator(); near.frequency.value = 50.15;
    const nearGain = ctx.createGain(); nearGain.gain.value = .28;
    low.connect(hum); near.connect(nearGain).connect(hum);
    // A distant ventilation duct, with a slow pressure fluctuation rather than a musical drone.
    const vent = ctx.createBufferSource(); vent.buffer = this.noiseBuffer; vent.loop = true;
    const ventFilter = ctx.createBiquadFilter(); ventFilter.type = 'bandpass'; ventFilter.frequency.value = 310; ventFilter.Q.value = .65;
    const ventGain = ctx.createGain(); ventGain.gain.value = .075;
    vent.connect(ventFilter).connect(ventGain); this.route(ventGain);
    const sway = ctx.createOscillator(); sway.frequency.value = .13;
    const swayDepth = ctx.createGain(); swayDepth.gain.value = .014;
    sway.connect(swayDepth).connect(ventGain.gain);
    // Water combines broad filtered spray with small high-frequency surface texture.
    const water = ctx.createBufferSource(); water.buffer = this.noiseBuffer; water.loop = true; water.playbackRate.value = 1.07;
    const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 190;
    const spray = ctx.createBiquadFilter(); spray.type = 'lowpass'; spray.frequency.value = 3900; spray.Q.value = .55;
    this.waterGain = ctx.createGain(); this.waterGain.gain.value = this.water ? .19 : 0;
    water.connect(highpass).connect(spray).connect(this.waterGain); this.route(this.waterGain);
    this.loops = [low, near, vent, sway, water];
    this.loopNodes = [hum, nearGain, ventFilter, ventGain, swayDepth, highpass, spray, this.waterGain];
    for (const source of this.loops) source.start();
  }

  cue(kind: AudioCue, force = false): void {
    if (!this.ctx || !this.master || !this.unlocked || this.muted) return;
    // 'danger' is allowed while inactive for the death screech, which rings after ambience stops.
    if (!this.active && kind !== 'fail' && kind !== 'win' && kind !== 'interact' && kind !== 'danger' && kind !== 'screech') return;
    const ctx = this.ctx, now = ctx.currentTime;
    const minInterval = kind === 'footstep' ? .27 : kind === 'knock' ? .3 : kind === 'danger' ? 1.25 : kind === 'whisper' ? 1.6 : .16;
    if (!force && (now - (this.cooldown.get(kind) ?? -10) < minInterval || this.voices.size >= 12)) return;
    this.cooldown.set(kind, now);
    this.room();
    const variant = this.sequence++ % 2;
    const source = ctx.createBufferSource();
    const buffer = kind === 'footstep' ? this.buffers.get(`footstep${variant}`) : this.buffers.get(kind);
    source.buffer = buffer ?? this.buffers.get('danger')!;
    source.playbackRate.value = kind === 'footstep' || kind === 'interact' || kind === 'knock' ? (variant ? .97 : 1.035) : 1;
    const gain = ctx.createGain();
    gain.gain.value = kind === 'footstep' ? .33 : kind === 'knock' ? .55 : kind === 'fail' ? .55 : kind === 'screech' ? .5 : kind === 'whisper' ? .2 : kind === 'danger' ? .24 : kind === 'win' ? .22 : .28;
    const pan = ctx.createStereoPanner();
    pan.pan.value = kind === 'footstep' ? (variant ? -.12 : .12) : kind === 'knock' ? -.35 : 0;
    if (kind === 'whisper') {
      pan.pan.setValueAtTime(variant ? -.48 : .48, now);
      pan.pan.linearRampToValueAtTime(variant ? .35 : -.35, now + 2.3);
    }
    source.connect(gain).connect(pan); this.route(pan);
    const voice = { source, gain, pan };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect(); gain.disconnect(); pan.disconnect();
    };
    source.start();
  }

  /** Pre-render physical excitation/resonance into mono buffers once, keeping live node counts low. */
  private texturesReady?: Promise<void>;
  private prepareTextures(): Promise<void> {
    if (this.texturesReady) return this.texturesReady;
    const ctx = this.ctx!;
    const apply = (data: SynthesisResult) => {
      const decode = (channels: Float32Array[]) => {
        const buffer = ctx.createBuffer(channels.length, channels[0].length, ctx.sampleRate);
        channels.forEach((channel, index) => buffer.copyToChannel(new Float32Array(channel), index));
        return buffer;
      };
      this.noiseBuffer = decode(data.noise);
      this.impulse = decode(data.impulse);
      for (const cue of data.cues) this.buffers.set(cue.name, decode(cue.channels));
    };
    if (location.protocol === 'file:') {
      // file:// pages cannot spawn any worker (blob and data: included);
      // synthesize on the main thread instead (one brief hitch right after start).
      this.texturesReady = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          try {
            apply(synthesize(ctx.sampleRate));
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 60);
      });
      return this.texturesReady;
    }
    this.texturesReady = new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./audio-synthesis.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        apply(data);
        worker.terminate();
        resolve();
      };
      worker.onerror = () => { worker.terminate(); reject(new Error('Audio synthesis failed')); };
      worker.postMessage(ctx.sampleRate);
    });
    return this.texturesReady;
  }

  private stopSources(): void {
    this.stopSpeech();
    for (const source of this.loops) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    for (const voice of this.voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Already ended. */ }
      voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect();
    }
    this.loops = []; this.voices.clear();
    for (const node of this.loopNodes) node.disconnect();
    this.loopNodes = [];
    this.waterGain = undefined;
    this.dry?.disconnect(); this.send?.disconnect(); this.convolver?.disconnect(); this.wet?.disconnect();
    this.dry = this.send = this.wet = undefined;
    this.convolver = undefined;
  }

  dispose(): void {
    this.stopSources();
    this.active = this.unlocked = false;
    this.master?.disconnect();
    void this.ctx?.close();
    this.ctx = this.master = undefined;
    this.buffers.clear();
    this.noiseBuffer = this.impulse = undefined;
  }
}
