import type { Song } from './types';

export interface TrackState { gain: number; muted: boolean; soloed: boolean; }

const BUCKETS = 700;

function computePeaks(buf: AudioBuffer, buckets = BUCKETS): Float32Array {
  const out = new Float32Array(buckets);
  const d0 = buf.getChannelData(0);
  const d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const step = Math.floor(d0.length / buckets) || 1;
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const s = i * step;
    const e = Math.min(s + step, d0.length);
    for (let j = s; j < e; j += 4) {
      let v = Math.abs(d0[j]);
      if (d1) v = Math.max(v, Math.abs(d1[j]));
      if (v > max) max = v;
    }
    out[i] = max;
  }
  return out;
}

export class Engine {
  ctx: AudioContext;
  master: GainNode;
  micGain: GainNode;
  buffers: AudioBuffer[] = [];
  peaks: Float32Array[] = [];
  gains: GainNode[] = [];
  states: TrackState[] = [];
  playing = false;
  duration = 0;
  onTick: ((t: number) => void) | null = null;
  onPlayState: ((p: boolean) => void) | null = null;
  onEnded: (() => void) | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private startCtxTime = 0;
  private offset = 0;
  private raf = 0;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 0.8;
    this.micGain.connect(this.ctx.destination);
  }

  async loadSong(song: Song): Promise<void> {
    this.pause();
    this.offset = 0;
    this.buffers = [];
    this.peaks = [];
    this.duration = 0;
    this.states = song.stems.map(() => ({ gain: 0.85, muted: false, soloed: false }));
    const decoded = await Promise.all(song.stems.map(async (s: any) => {
      const res = await fetch(s.file || s.src);
      if (!res.ok) throw new Error(`${s.name} の読み込みに失敗しました (${res.status})`);
      const ab = await res.arrayBuffer();
      return this.ctx.decodeAudioData(ab);
    }));
    this.buffers = decoded;
    this.peaks = decoded.map((b: AudioBuffer) => computePeaks(b));
    this.gains = decoded.map(() => {
      const g = this.ctx.createGain();
      g.connect(this.master);
      return g;
    });
    this.duration = Math.max(...decoded.map((b: AudioBuffer) => b.duration));
    this.applyGains();
    this.onTick?.(0);
  }

  private stopSources() {
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already stopped */ }
      s.disconnect();
    }
    this.sources = [];
  }

  private applyGains() {
    const anySolo = this.states.some((t) => t.soloed);
    this.states.forEach((t, i) => {
      const audible = !t.muted && (!anySolo || t.soloed);
      this.gains[i]?.gain.setTargetAtTime(audible ? t.gain : 0, this.ctx.currentTime, 0.01);
    });
  }

  get position(): number {
    const t = this.playing ? this.offset + this.ctx.currentTime - this.startCtxTime : this.offset;
    return Math.min(Math.max(t, 0), this.duration || 0);
  }

  play(from?: number) {
    if (!this.buffers.length) return;
    this.stopSources();
    if (from !== undefined) this.offset = Math.min(Math.max(from, 0), this.duration);
    if (this.offset >= this.duration - 0.01) this.offset = 0;
    void this.ctx.resume();
    this.startCtxTime = this.ctx.currentTime;
    this.buffers.forEach((buf, i) => {
      if (this.offset >= buf.duration) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gains[i]);
      src.start(0, this.offset);
      this.sources.push(src);
    });
    this.playing = true;
    this.onPlayState?.(true);
    const tick = () => {
      if (!this.playing) return;
      const t = this.position;
      this.onTick?.(t);
      if (t >= this.duration - 0.02) {
        this.pause();
        this.offset = 0;
        this.onTick?.(0);
        this.onEnded?.();
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    if (this.playing) {
      this.offset = this.position;
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.stopSources();
      this.onPlayState?.(false);
      this.onTick?.(this.offset);
    }
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    const was = this.playing;
    if (was) {
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.stopSources();
    }
    this.offset = Math.min(Math.max(t, 0), this.duration);
    if (was) this.play(this.offset);
    else this.onTick?.(this.offset);
  }

  nudge(dt: number) {
    this.seek(this.position + dt);
  }

  toStart() {
    this.seek(0);
  }

  setTrack(i: number, patch: Partial<TrackState>) {
    this.states[i] = { ...this.states[i], ...patch };
    this.applyGains();
  }

  setMaster(v: number) {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  get micOn() {
    return !!this.micSource;
  }

  async enableMic(): Promise<void> {
    if (this.micSource) return;
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.micGain);
    void this.ctx.resume();
  }

  disableMic() {
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
  }

  setMicVolume(v: number) {
    this.micGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  dispose() {
    this.disableMic();
    this.stopSources();
    cancelAnimationFrame(this.raf);
    void this.ctx.close();
  }
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const ROLE_COLORS: Record<string, string> = {
  vocal: '#ff5f7e',
  drums: '#ffb347',
  bass: '#4ecdc4',
  guitar: '#9b8cff',
  piano: '#5ad1ff',
  other: '#b8c0cc'
};
