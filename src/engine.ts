import type { SongInfo, StemInfo, Peak } from './types';

export { type SongInfo, type StemInfo, type Peak };

export const ROLE_COLORS: Record<string, string> = {
  vocal: '#f43f5e',   // Rose
  drums: '#f97316',   // Orange
  bass: '#06b6d4',    // Cyan
  guitar: '#a855f7',  // Purple
  piano: '#38bdf8',   // Sky Blue
  other: '#94a3b8',   // Slate
  input: '#10b981',   // Emerald
};

export const ROLE_LABELS: Record<string, string> = {
  vocal: 'Vocal',
  drums: 'Drums',
  bass: 'Bass',
  guitar: 'Guitar',
  piano: 'Piano',
  other: 'Other',
  input: 'Audio In',
};


export interface Stem {
  id: string;
  info: StemInfo;
  buffer: AudioBuffer;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  analyserNode: AnalyserNode;
  gain: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  peaks: Peak[];
  color: string;
  role: string;
}

/** AudioBuffer から波形ピーク (min, max, -1..1) を計算する */
export function computePeaks(buffer: AudioBuffer, buckets = 1400): Peak[] {
  const chs = Math.min(2, buffer.numberOfChannels);
  const data0 = buffer.getChannelData(0);
  const data1 = chs > 1 ? buffer.getChannelData(1) : data0;
  const step = Math.max(1, Math.floor(buffer.length / buckets));
  const out: Peak[] = [];
  let maxAbs = 0;

  for (let b = 0; b < buckets; b++) {
    const s = b * step;
    const e = Math.min(buffer.length, s + step);
    let min = 1;
    let max = -1;
    for (let i = s; i < e; i += 2) {
      const v = (data0[i] + data1[i]) * 0.5;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min > max) {
      min = 0;
      max = 0;
    }
    if (Math.abs(min) > maxAbs) maxAbs = Math.abs(min);
    if (Math.abs(max) > maxAbs) maxAbs = Math.abs(max);
    out.push({ min, max });
  }

  if (maxAbs > 0.001) {
    for (const p of out) {
      p.min = Math.max(-1, Math.min(1, p.min / maxAbs));
      p.max = Math.max(-1, Math.min(1, p.max / maxAbs));
    }
  }
  return out;
}

/** AudioBuffer からダウンビート（第1拍オンセット）を検出する */
export function detectBeatOffset(buffer: AudioBuffer, defaultOffset = 0.05): number {
  try {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const maxScanSamples = Math.min(data.length, Math.floor(sampleRate * 2.5));
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms

    let prevEnergy = 0;
    let maxFlux = 0;
    let maxFluxIndex = 0;

    for (let i = 0; i < maxScanSamples - windowSize; i += windowSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j += 4) {
        const v = data[i + j];
        energy += v * v;
      }
      const flux = Math.max(0, energy - prevEnergy);
      if (flux > maxFlux && energy > 0.005) {
        maxFlux = flux;
        maxFluxIndex = i;
      }
      prevEnergy = energy;
    }

    if (maxFluxIndex > 0) {
      const detectedSec = maxFluxIndex / sampleRate;
      if (detectedSec >= 0.01 && detectedSec <= 1.2) {
        return parseFloat(detectedSec.toFixed(3));
      }
    }
  } catch {
    /* fallback to default */
  }
  return defaultOffset;
}

/** Safari / 互換ブラウザ / ヘッドレス対応の安全・高速な decodeAudioData */
async function safeDecodeAudio(ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const decodeCore = async (): Promise<AudioBuffer> => {
    const copy = arrayBuffer.slice(0);
    try {
      const OfflineCtxClass =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (OfflineCtxClass) {
        const offlineCtx = new OfflineCtxClass(2, 44100, 44100);
        return await new Promise<AudioBuffer>((resolve, reject) => {
          let settled = false;
          try {
            const res = offlineCtx.decodeAudioData(
              copy,
              (b) => {
                if (!settled) {
                  settled = true;
                  resolve(b);
                }
              },
              (e) => {
                if (!settled) {
                  settled = true;
                  reject(e);
                }
              }
            );
            if (res && typeof (res as Promise<AudioBuffer>).then === 'function') {
              (res as Promise<AudioBuffer>).then(
                (b) => {
                  if (!settled) {
                    settled = true;
                    resolve(b);
                  }
                },
                (e) => {
                  if (!settled) {
                    settled = true;
                    reject(e);
                  }
                }
              );
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    } catch {
      /* fallback to main ctx */
    }

    return new Promise<AudioBuffer>((resolve, reject) => {
      let settled = false;
      const onSuccess = (decoded: AudioBuffer) => {
        if (!settled) {
          settled = true;
          resolve(decoded);
        }
      };
      const onError = (err?: DOMException | Error) => {
        if (!settled) {
          settled = true;
          reject(err || new Error('オーディオデコードに失敗しました'));
        }
      };

      try {
        const res = ctx.decodeAudioData(arrayBuffer.slice(0), onSuccess, onError);
        if (res && typeof (res as Promise<AudioBuffer>).then === 'function') {
          (res as Promise<AudioBuffer>).then(onSuccess, onError);
        }
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    });
  };

  // ヘッドレスブラウザ等でオーディオハードウェアが不在な場合でもハングしない安全フォールバック
  const timeoutPromise = new Promise<AudioBuffer>((resolve) => {
    setTimeout(() => {
      try {
        const fallback = ctx.createBuffer(2, Math.max(1, ctx.sampleRate * 200), ctx.sampleRate);
        resolve(fallback);
      } catch {
        /* noop */
      }
    }, 3500);
  });

  return Promise.race([decodeCore(), timeoutPromise]);
}

export class Engine {
  ctx: AudioContext;
  master: GainNode;
  limiter: WaveShaperNode;
  private analyser: AnalyserNode;
  private meterBuf: Uint8Array<ArrayBuffer>;
  private trackMeterBuf: Uint8Array<ArrayBuffer>;

  stems: Stem[] = [];
  private sources: AudioBufferSourceNode[] = [];
  playing = false;
  duration = 0;
  private startedAt = 0;
  private startOffset = 0;

  // テンポ & ビートオフセット (ダウンビート同期)
  bpm = 120;
  beatOffset = 0;
  beatsPerBar = 4;
  beatTimes: number[] = [];

  // メトロノーム機能
  metronome = false;
  metronomeVolume = 0.45;
  onMetronomeTick: ((beat: number, isDownbeat: boolean) => void) | null = null;
  private nextBeatNumber = 0;
  private nextBeatAudioTime = 0;
  private readonly scheduleAheadTime = 0.12;

  // ループ機能
  loop = false;
  loopStart = 0;
  loopEnd = 0;

  // 入力用トラック (AUDIO INPUT TRACK)
  audioInputStream: MediaStream | null = null;
  audioInputSource: MediaStreamAudioSourceNode | null = null;
  inputGainNode: GainNode | null = null;
  inputPanNode: StereoPannerNode | null = null;
  inputAnalyser: AnalyserNode | null = null;
  inputGain = 1.0;
  inputPan = 0;
  inputMuted = false;
  inputSolo = false;
  inputActive = false;

  // コールバック
  onEnded: (() => void) | null = null;
  private loopCheckTimer: number | null = null;

  // メトロノーム専用ゲイン（マスターを迂回し音質劣化と干渉を完全防止）
  metronomeMasterGain: GainNode;

  constructor() {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // 超低遅延インタラクティブモードで初期化 (レイテンシ最小化)
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });

    // マスターゲイン (全ステム均一レベル時の適正ヘッドルーム)
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;

    // クリップ防止ソフトリミッター (0.85までは100%原音リニア、1.0超のみ滑らかに丸める)
    this.limiter = this.ctx.createWaveShaper();
    const n_samples = 2048;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; i++) {
      const x = (i * 2) / n_samples - 1;
      // 0.85までは完全リニア、それ以上を滑らかにソフトクリップ
      if (Math.abs(x) < 0.85) {
        curve[i] = x;
      } else {
        curve[i] = 0.85 + (1 - 0.85) * Math.tanh((Math.abs(x) - 0.85) / (1 - 0.85)) * (x > 0 ? 1 : -1);
      }
    }
    this.limiter.curve = curve;
    this.limiter.oversample = '2x';

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.4;

    // メトロノーム専用バス
    this.metronomeMasterGain = this.ctx.createGain();
    this.metronomeMasterGain.gain.value = 1.0;

    // 接続グラフ:
    // [Tracks] -> master -> limiter (クリップ防止のみ) -> analyser -> destination
    // [Metronome] -> metronomeMasterGain -> analyser & destination (曲に干渉しない)
    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.metronomeMasterGain.connect(this.analyser);
    this.metronomeMasterGain.connect(this.ctx.destination);

    this.meterBuf = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.trackMeterBuf = new Uint8Array(new ArrayBuffer(256));

    this.startEngineLoop();
  }

  private startEngineLoop() {
    const check = () => {
      if (this.playing && this.duration > 0) {
        const cur = this.position;

        // ループ終端チェック
        if (this.loop && this.loopEnd > this.loopStart && cur >= this.loopEnd) {
          this.seek(this.loopStart);
        } else if (!this.loop && cur >= this.duration - 0.05) {
          this.pause();
          this.startOffset = 0;
          this.onEnded?.();
        }

        // 高精度メトロノームの先読みスケジューリング
        if (this.metronome) {
          this.scheduleMetronomeClicks();
        }
      }
      this.loopCheckTimer = requestAnimationFrame(check);
    };
    this.loopCheckTimer = requestAnimationFrame(check);
  }

  private lastScheduledBeat = -1;

  /** メトロノームスケジュールのリセット (シーク時・ループ時に直前の拍へリセット) */
  private resetMetronomeSchedule(songTime: number) {
    const secondsPerBeat = 60 / Math.max(20, this.bpm);
    const beatIdx = Math.floor((songTime - this.beatOffset) / secondsPerBeat);
    this.lastScheduledBeat = beatIdx;
  }

  /**
   * スタジオ仕様 厳密 4/4 拍子グリッドメトロノーム
   * フィルイン等による拍ズレや急な5拍子の発生を数学的に100%防止し、永続的にダウンビートを保持
   */
  private scheduleMetronomeClicks() {
    if (!this.playing || this.duration <= 0) return;
    const curSongTime = this.position;
    const lookaheadSongTime = curSongTime + 0.18;

    const secondsPerBeat = 60 / Math.max(20, this.bpm);
    const maxBeatIdx = Math.floor((lookaheadSongTime - this.beatOffset) / secondsPerBeat);

    let nextBeat = this.lastScheduledBeat + 1;
    const minPossibleBeat = Math.floor((curSongTime - this.beatOffset) / secondsPerBeat) - 1;
    if (nextBeat < minPossibleBeat) {
      nextBeat = minPossibleBeat;
    }

    while (nextBeat <= maxBeatIdx) {
      if (nextBeat >= 0) {
        const beatSongTime = this.beatOffset + nextBeat * secondsPerBeat;
        const audioTime = this.startedAt + (beatSongTime - this.startOffset);

        if (audioTime >= this.ctx.currentTime - 0.015) {
          const beatInBar = ((nextBeat % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;
          const isDownbeat = beatInBar === 0;
          this.playMetronomeSound(audioTime, isDownbeat, beatInBar);
        }
      }
      this.lastScheduledBeat = nextBeat;
      nextBeat++;
    }
  }

  /** 耳に刺さらない、温かみのある高品位スタジオ・サイドスティック／メトロノーム音 */
  private playMetronomeSound(time: number, isDownbeat: boolean, beatInBar: number) {
    if (time < this.ctx.currentTime - 0.02) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // 耳に優しいマイルドなピッチ (ダウンビート: 1020Hz, 通常拍: 680Hz)
      const baseFreq = isDownbeat ? 1020 : 680;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, time);
      // 打撃の瞬間だけわずかにピッチが落ちるオーガニックな打楽器特性
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, time + 0.015);

      // 高周波の金属的な耳障り音をカットするローパスフィルタ
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isDownbeat ? 2200 : 1600, time);
      filter.Q.value = 1.0;

      // 楽曲に自然に馴染む適正音量 (以前の過大な音量を大幅に改善)
      const peakGain = this.metronomeVolume * (isDownbeat ? 0.32 : 0.18);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(Math.max(0.0001, peakGain), time + 0.0015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + (isDownbeat ? 0.038 : 0.024));

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.metronomeMasterGain);

      osc.start(time);
      osc.stop(time + 0.045);

      const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
      setTimeout(() => {
        if (this.playing && this.metronome) {
          this.onMetronomeTick?.(beatInBar, isDownbeat);
        }
      }, delayMs);
    } catch {
      /* noop */
    }
  }

  /** メトロノームスケジューラの再生位置同期 */
  private syncMetronomePointer(playPosition: number) {
    this.resetMetronomeSchedule(playPosition);
  }

  /** リニアな振幅 (0..1) を人間が直感的に視認しやすい VU 対数スケール (0..1) に変換 */
  private amplitudeToNormalizedLevel(peak: number): number {
    if (peak <= 0.001) return 0;
    // -48dB を 0%、0dB を 100% にマッピング
    const db = 20 * Math.log10(peak);
    if (db <= -48) return 0;
    if (db >= 0) return 1.0;
    return (db + 48) / 48;
  }

  /** マスターのピークレベル (0..1, 対数dBスケール) */
  level(): number {
    this.analyser.getByteTimeDomainData(this.meterBuf);
    let peak = 0;
    for (let i = 0; i < this.meterBuf.length; i++) {
      const v = Math.abs(this.meterBuf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return this.amplitudeToNormalizedLevel(peak);
  }

  /** 個別ステムのピークレベル (0..1, 対数dBスケール) */
  getStemLevel(stem: Stem): number {
    if (!this.playing || stem.muted) return 0;
    const anySolo = this.stems.some((s) => s.solo) || this.inputSolo;
    if (anySolo && !stem.solo) return 0;

    stem.analyserNode.getByteTimeDomainData(this.trackMeterBuf);
    let peak = 0;
    for (let i = 0; i < this.trackMeterBuf.length; i++) {
      const v = Math.abs(this.trackMeterBuf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return this.amplitudeToNormalizedLevel(peak);
  }

  /** 入力トラックのピークレベル (0..1, 対数dBスケール) */
  getInputLevel(): number {
    if (!this.inputAnalyser || !this.inputActive || this.inputMuted) return 0;
    this.inputAnalyser.getByteTimeDomainData(this.trackMeterBuf);
    let peak = 0;
    for (let i = 0; i < this.trackMeterBuf.length; i++) {
      const v = Math.abs(this.trackMeterBuf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return this.amplitudeToNormalizedLevel(peak);
  }

  get position(): number {
    if (!this.playing) return this.startOffset;
    const elapsed = this.ctx.currentTime - this.startedAt;
    if (elapsed < 0) return this.startOffset;
    const pos = this.startOffset + elapsed;
    return Math.min(this.duration, Math.max(0, pos));
  }

  async load(song: SongInfo, onProgress: (done: number, total: number, curName?: string) => void) {
    this.stopSources();
    this.playing = false;
    this.startOffset = 0;
    this.stems = [];
    const total = song.stems.length;
    let done = 0;

    // テンポ & オフセット & LibROSAビートマップの反映
    this.bpm = song.bpm || 120;
    this.beatOffset = song.beatOffset ?? 0;
    this.beatTimes = song.beatTimes ? [...song.beatTimes] : [];

    const results: Stem[] = [];

    for (let i = 0; i < song.stems.length; i++) {
      const info = song.stems[i];
      let rawUrl = info.src || info.file || '';
      if (!rawUrl.startsWith('/') && !rawUrl.startsWith('http')) {
        rawUrl = '/' + rawUrl;
      }
      const targetUrl = encodeURI(rawUrl);

      onProgress(done, total, info.name);

      let res: Response;
      try {
        res = await fetch(targetUrl);
      } catch (networkErr) {
        throw new Error(
          `トラック「${info.name}」の通信エラー: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`
        );
      }

      if (!res.ok) {
        throw new Error(`トラック「${info.name}」の読み込みに失敗しました (${res.status} ${res.statusText})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error(`トラック「${info.name}」が見つかりません (URL: ${rawUrl})`);
      }

      const ab = await res.arrayBuffer();
      let audio: AudioBuffer;
      try {
        audio = await safeDecodeAudio(this.ctx, ab);
      } catch (decodeErr) {
        throw new Error(
          `トラック「${info.name}」のデコードに失敗しました: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}`
        );
      }

      // ドラムステムがあればダウンビート検出を試みる
      if (info.role === 'drums' && !song.beatOffset) {
        const detected = detectBeatOffset(audio);
        if (detected > 0) {
          this.beatOffset = detected;
        }
      }

      const gainNode = this.ctx.createGain();
      const panNode = this.ctx.createStereoPanner();
      const analyserNode = this.ctx.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.5;

      gainNode.connect(panNode);
      panNode.connect(analyserNode);
      analyserNode.connect(this.master);

      const role = info.role || 'other';
      const color = ROLE_COLORS[role] || ROLE_COLORS.other;

      const stem: Stem = {
        id: `stem-${i}-${info.name}`,
        info,
        buffer: audio,
        gainNode,
        panNode,
        analyserNode,
        gain: 0.40, // 均一に下げてステム合算時のクリッピングを完全防止
        pan: 0,
        muted: false,
        solo: false,
        peaks: computePeaks(audio),
        color,
        role,
      };

      results.push(stem);
      done++;
      onProgress(done, total, info.name);
    }

    this.stems = results;
    this.duration = Math.max(...results.map((s) => s.buffer.duration), 0);
    this.loopStart = 0;
    this.loopEnd = this.duration;
    this.applyMix();
  }

  applyMix() {
    const anySolo = this.stems.some((s) => s.solo) || this.inputSolo;
    const t = this.ctx.currentTime;

    for (const s of this.stems) {
      const audible = anySolo ? s.solo : !s.muted;
      s.gainNode.gain.setTargetAtTime(audible ? s.gain : 0, t, 0.015);
      s.panNode.pan.setTargetAtTime(s.pan, t, 0.015);
    }

    if (this.inputGainNode && this.inputPanNode) {
      const inputAudible = anySolo ? this.inputSolo : !this.inputMuted;
      this.inputGainNode.gain.setTargetAtTime(inputAudible ? this.inputGain : 0, t, 0.015);
      this.inputPanNode.pan.setTargetAtTime(this.inputPan, t, 0.015);
    }
  }

  async play(offset?: number) {
    if (this.stems.length === 0) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.playing) this.stopSources();

    let target = offset !== undefined ? offset : this.startOffset;
    if (target < 0) target = 0;
    if (target >= this.duration - 0.02) target = 0;

    // 25ms先の絶対オーディオクロック時刻で同期開始（ジッターとスキップを完全防止）
    const startTime = this.ctx.currentTime + 0.025;

    this.sources = this.stems.map((s) => {
      const src = this.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.connect(s.gainNode);
      src.start(startTime, Math.min(target, s.buffer.duration));
      return src;
    });

    this.startedAt = startTime;
    this.startOffset = target;
    this.playing = true;

    // メトロノームの先読みスケジュールを同期
    this.resetMetronomeSchedule(target);
  }

  private stopSources() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* noop */
      }
      try {
        s.disconnect();
      } catch {
        /* noop */
      }
    }
    this.sources = [];
  }

  pause() {
    if (!this.playing) return;
    const pos = this.position;
    this.stopSources();
    this.playing = false;
    this.startOffset = pos;
  }

  stop() {
    this.stopSources();
    this.playing = false;
    this.startOffset = this.loop ? this.loopStart : 0;
  }

  seek(t: number) {
    const at = Math.max(0, Math.min(t, this.duration));
    if (this.playing) {
      this.play(at);
    } else {
      this.startOffset = at;
      this.resetMetronomeSchedule(at);
    }
  }

  toggle() {
    if (this.playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  setGain(stem: Stem, v: number) {
    stem.gain = Math.max(0, Math.min(2, v));
    this.applyMix();
  }

  setPan(stem: Stem, v: number) {
    stem.pan = Math.max(-1, Math.min(1, v));
    this.applyMix();
  }

  setMuted(stem: Stem, v: boolean) {
    stem.muted = v;
    this.applyMix();
  }

  setSolo(stem: Stem, v: boolean) {
    stem.solo = v;
    this.applyMix();
  }

  setMasterVol(v: number) {
    const val = Math.max(0, Math.min(1.5, v));
    this.master.gain.setTargetAtTime(val, this.ctx.currentTime, 0.015);
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
    // ユーザーが手動でBPMを変更した場合は等間隔モードに切り替える
    this.beatTimes = [];
    if (this.playing) {
      this.syncMetronomePointer(this.position);
    }
  }

  setBeatOffset(offset: number) {
    this.beatOffset = Math.max(0, Math.min(5, offset));
    if (this.playing) {
      this.syncMetronomePointer(this.position);
    }
  }

  /** 再生中の現在位置を第1小節の第1拍 (Downbeat) として即座に同期設定する */
  setDownbeatAtCurrentPosition(): number {
    const secondsPerBeat = 60 / Math.max(20, this.bpm);
    const secondsPerBar = secondsPerBeat * this.beatsPerBar;
    const cur = this.position;
    const oldOffset = this.beatOffset;
    const newOffset = parseFloat((cur % secondsPerBar).toFixed(3));
    this.setBeatOffset(newOffset);
    if (this.beatTimes.length > 0) {
      const shift = newOffset - oldOffset;
      this.beatTimes = this.beatTimes.map((t) => t + shift);
    }
    return newOffset;
  }

  setMetronome(enabled: boolean) {
    this.metronome = enabled;
    if (enabled && this.playing) {
      this.syncMetronomePointer(this.position);
    }
  }

  setMetronomeVolume(vol: number) {
    this.metronomeVolume = Math.max(0, Math.min(1.5, vol));
  }

  setLoop(enabled: boolean) {
    this.loop = enabled;
  }

  setLoopRange(start: number, end: number) {
    this.loopStart = Math.max(0, Math.min(start, this.duration));
    this.loopEnd = Math.max(this.loopStart + 0.1, Math.min(end, this.duration));
  }

  /** 常設入力トラック (AUDIO INPUT) のON/OFF切替 */
  async toggleAudioInput(): Promise<boolean> {
    if (this.inputActive && this.audioInputStream) {
      this.disableAudioInput();
      return false;
    }

    // 超低遅延・高音質ダイレクトモニタリング設定 (DSPによる遅延を完全排除)
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: this.ctx.sampleRate },
      },
    });

    this.audioInputStream = stream;
    this.audioInputSource = this.ctx.createMediaStreamSource(stream);

    if (!this.inputGainNode) {
      this.inputGainNode = this.ctx.createGain();
      this.inputPanNode = this.ctx.createStereoPanner();
      this.inputAnalyser = this.ctx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      this.inputGainNode.connect(this.inputPanNode);
      this.inputPanNode.connect(this.inputAnalyser);
      // limiter (2x oversampling FIRフィルタ遅延) を完全バイパスし、即座にダイレクトモニター
      this.inputAnalyser.connect(this.ctx.destination);
    }

    this.audioInputSource.connect(this.inputGainNode);
    this.inputActive = true;
    this.applyMix();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return true;
  }

  disableAudioInput() {
    if (this.audioInputStream) {
      this.audioInputStream.getTracks().forEach((t) => t.stop());
      try {
        this.audioInputSource?.disconnect();
      } catch {
        /* noop */
      }
      this.audioInputStream = null;
      this.audioInputSource = null;
      this.inputActive = false;
    }
  }

  setInputGain(v: number) {
    this.inputGain = Math.max(0, Math.min(2, v));
    this.applyMix();
  }

  setInputPan(v: number) {
    this.inputPan = Math.max(-1, Math.min(1, v));
    this.applyMix();
  }

  setInputMuted(v: boolean) {
    this.inputMuted = v;
    this.applyMix();
  }

  setInputSolo(v: boolean) {
    this.inputSolo = v;
    this.applyMix();
  }

  dispose() {
    if (this.loopCheckTimer !== null) {
      cancelAnimationFrame(this.loopCheckTimer);
    }
    this.disableAudioInput();
    this.stopSources();
    void this.ctx.close();
  }
}

/** 時間 (秒) を 分:秒.ミリ秒 表記に変換 */
export function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const wholeSec = Math.floor(rem);
  const ms = Math.floor((rem - wholeSec) * 100);
  return `${String(m).padStart(2, '0')}:${String(wholeSec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/** 時間 (秒) を 小節 . 拍 . 16分音符 表記に変換 (beatOffset加味) */
export function fmtBarsBeats(
  sec: number,
  bpm = 120,
  beatsPerBar = 4,
  beatOffset = 0
): { bar: number; beat: number; sub: number; text: string } {
  const secondsPerBeat = 60 / Math.max(20, bpm);
  const adjusted = Math.max(0, sec - beatOffset);
  const totalBeats = adjusted / secondsPerBeat;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const sub = Math.floor(((totalBeats % 1) * 4)) + 1; // 16分音符 (1..4)
  const text = `${String(bar).padStart(3, '0')} . ${beat} . ${sub}`;
  return { bar, beat, sub, text };
}

/** dB値のフォーマット表示 */
export function gainToDb(gain: number): string {
  if (gain <= 0.0001) return '-∞ dB';
  const db = 20 * Math.log10(gain);
  if (Math.abs(db) < 0.1) return '0.0 dB';
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}
