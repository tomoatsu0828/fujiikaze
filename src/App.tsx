import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { Engine, type SongInfo, type Stem } from './engine';
import type { Manifest } from './types';
import TransportBar from './components/TransportBar';
import DawTimeline from './components/DawTimeline';
import ProjectModal from './components/ProjectModal';
import {
  IconPlay,
  IconPause,
  IconStop,
  IconRTZ,
  IconRewind,
  IconFastForward,
  IconLoop,
  IconMetronome,
  IconProject,
} from './components/Icons';

export default function App() {
  const [songs, setSongs] = useState<SongInfo[]>([]);
  const [currentSong, setCurrentSong] = useState<SongInfo | null>(null);
  const [stems, setStems] = useState<Stem[]>([]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isInitialLaunch, setIsInitialLaunch] = useState(true);

  // 再生・トランスポート状態
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [beatOffset, setBeatOffset] = useState(0);
  const [loop, setLoop] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(0);
  const [masterVol, setMasterVol] = useState(0.85);
  const [zoom, setZoom] = useState(1.0);

  // メトロノーム状態
  const [metronome, setMetronome] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(0.75);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isDownbeat, setIsDownbeat] = useState(false);

  // 常設入力トラック (AUDIO INPUT) 状態
  const [inputActive, setInputActive] = useState(false);
  const [inputGain, setInputGain] = useState(1.0);
  const [inputPan, setInputPan] = useState(0);
  const [inputMuted, setInputMuted] = useState(false);
  const [inputSolo, setInputSolo] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);

  // メーター状態
  const [masterLevel, setMasterLevel] = useState(0);
  const [stemLevels, setStemLevels] = useState<number[]>([]);

  // ローディング & エラー
  const [loading, setLoading] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [loadingTrackName, setLoadingTrackName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<Engine | null>(null);

  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new Engine();
      engineRef.current.onEnded = () => {
        setPlaying(false);
        setPosition(0);
      };
      engineRef.current.onMetronomeTick = (beat, downbeat) => {
        setCurrentBeat(beat);
        setIsDownbeat(downbeat);
      };
    }
    return engineRef.current;
  }, []);

  // 楽曲マニフェスト (stems.json) の読み込み
  useEffect(() => {
    fetch('/stems.json')
      .then((r) => {
        if (!r.ok) throw new Error(`stems.json の読み込みに失敗しました (${r.status})`);
        return r.json() as Promise<Manifest>;
      })
      .then((manifest) => {
        if (manifest.songs && manifest.songs.length > 0) {
          setSongs(manifest.songs);

          const params = new URLSearchParams(window.location.search);
          const targetSongName = params.get('song');
          if (targetSongName) {
            const matched = manifest.songs.find(
              (s) => s.title.includes(targetSongName) || s.dir.includes(targetSongName)
            );
            if (matched) {
              void loadSong(matched);
              return;
            }
          }

          // 通常はプロジェクト選択モーダルを開く
          setIsProjectModalOpen(true);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  // アニメーションフレームでの位置・メーター高精度ループ
  useEffect(() => {
    let raf = 0;
    let lastUiUpdate = 0;

    const renderLoop = (timestamp: number) => {
      const engine = engineRef.current;
      if (engine) {
        const curPos = engine.position;
        setPosition(curPos);

        const mLevel = engine.level();
        setMasterLevel(mLevel);

        if (engine.stems.length > 0) {
          const sLevels = engine.stems.map((s) => engine.getStemLevel(s));
          setStemLevels(sLevels);
        }

        if (engine.inputActive) {
          setInputLevel(engine.getInputLevel());
        }

        if (timestamp - lastUiUpdate > 300) {
          lastUiUpdate = timestamp;
          if (engine.playing !== playing) {
            setPlaying(engine.playing);
          }
        }
      }
      raf = requestAnimationFrame(renderLoop);
    };

    raf = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      const engine = engineRef.current;
      if (!engine || engine.stems.length === 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        engine.toggle();
        setPlaying(engine.playing);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        engine.stop();
        setPosition(engine.position);
        setPlaying(false);
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        const nextLoop = !engine.loop;
        engine.setLoop(nextLoop);
        setLoop(nextLoop);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        const nextMetro = !engine.metronome;
        engine.setMetronome(nextMetro);
        setMetronome(nextMetro);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        engine.seek(Math.max(0, engine.position - 5));
        setPosition(engine.position);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        engine.seek(Math.min(engine.duration, engine.position + 5));
        setPosition(engine.position);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 楽曲のロード処理 (正確なテンポ・ダウンビートを反映)
  async function loadSong(song: SongInfo) {
    const engine = ensureEngine();
    engine.pause();
    setCurrentSong(song);
    setIsInitialLaunch(false);
    setStems([]);
    setLoadPct(0);
    setLoading(true);
    setError(null);
    setPosition(0);
    setDuration(0);
    setPlaying(false);

    const initialBpm = song.bpm || 120;
    const initialOffset = song.beatOffset ?? 0;
    setBpm(initialBpm);
    setBeatOffset(initialOffset);
    engine.setBpm(initialBpm);
    engine.setBeatOffset(initialOffset);

    try {
      await engine.load(song, (done, total, curName) => {
        setLoadPct(Math.round((done / total) * 100));
        if (curName) setLoadingTrackName(curName);
      });
      setStems([...engine.stems]);
      setDuration(engine.duration);
      setLoopStart(0);
      setLoopEnd(engine.duration);
      setBeatOffset(engine.beatOffset);
      engine.setMasterVol(masterVol);
      engine.setMetronome(metronome);
      engine.setMetronomeVolume(metronomeVolume);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // トランスポート操作
  const handlePlay = useCallback(() => {
    const engine = ensureEngine();
    void engine.play();
    setPlaying(true);
  }, [ensureEngine]);

  const handlePause = useCallback(() => {
    const engine = ensureEngine();
    engine.pause();
    setPlaying(false);
  }, [ensureEngine]);

  const handleStop = useCallback(() => {
    const engine = ensureEngine();
    engine.stop();
    setPlaying(false);
    setPosition(engine.position);
  }, [ensureEngine]);

  const handleSeek = useCallback(
    (t: number) => {
      const engine = ensureEngine();
      engine.seek(t);
      setPosition(t);
    },
    [ensureEngine]
  );

  const handleToggleLoop = useCallback(() => {
    const engine = ensureEngine();
    const next = !engine.loop;
    engine.setLoop(next);
    setLoop(next);
  }, [ensureEngine]);

  const handleSetLoopRange = useCallback(
    (start: number, end: number) => {
      const engine = ensureEngine();
      engine.setLoopRange(start, end);
      setLoopStart(start);
      setLoopEnd(end);
    },
    [ensureEngine]
  );

  // メトロノーム操作
  const handleToggleMetronome = useCallback(() => {
    const engine = ensureEngine();
    const next = !engine.metronome;
    engine.setMetronome(next);
    setMetronome(next);
  }, [ensureEngine]);

  const handleMetronomeVolChange = useCallback(
    (vol: number) => {
      const engine = ensureEngine();
      engine.setMetronomeVolume(vol);
      setMetronomeVolume(vol);
    },
    [ensureEngine]
  );

  // テンポ & ビート同期
  const handleBpmChange = useCallback(
    (newBpm: number) => {
      const engine = ensureEngine();
      engine.setBpm(newBpm);
      setBpm(newBpm);
    },
    [ensureEngine]
  );

  const handleBeatOffsetChange = useCallback(
    (offset: number) => {
      const engine = ensureEngine();
      engine.setBeatOffset(offset);
      setBeatOffset(offset);
    },
    [ensureEngine]
  );

  const handleMasterVolChange = useCallback(
    (vol: number) => {
      const engine = ensureEngine();
      engine.setMasterVol(vol);
      setMasterVol(vol);
    },
    [ensureEngine]
  );

  const handleSetDownbeatHere = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const newOffset = engine.setDownbeatAtCurrentPosition();
      setBeatOffset(newOffset);
    }
  }, []);

  // トラックごとのコントロール
  const handleGainChange = useCallback((stem: Stem, gain: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setGain(stem, gain);
      setStems([...engine.stems]);
    }
  }, []);

  const handlePanChange = useCallback((stem: Stem, pan: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setPan(stem, pan);
      setStems([...engine.stems]);
    }
  }, []);

  const handleMuteToggle = useCallback((stem: Stem) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMuted(stem, !stem.muted);
      setStems([...engine.stems]);
    }
  }, []);

  const handleSoloToggle = useCallback((stem: Stem) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setSolo(stem, !stem.solo);
      setStems([...engine.stems]);
    }
  }, []);

  // 常設入力トラック (AUDIO INPUT) 操作
  const handleToggleInput = useCallback(async () => {
    const engine = ensureEngine();
    try {
      const active = await engine.toggleAudioInput();
      setInputActive(active);
      if (active) {
        engine.setInputGain(inputGain);
        engine.setInputPan(inputPan);
      }
    } catch (err) {
      setError(
        'マイク入力へのアクセスが許可されませんでした: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }, [ensureEngine, inputGain, inputPan]);

  const handleInputGainChange = useCallback((gain: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setInputGain(gain);
      setInputGain(gain);
    }
  }, []);

  const handleInputPanChange = useCallback((pan: number) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setInputPan(pan);
      setInputPan(pan);
    }
  }, []);

  const handleInputMuteToggle = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const next = !engine.inputMuted;
      engine.setInputMuted(next);
      setInputMuted(next);
    }
  }, []);

  const handleInputSoloToggle = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      const next = !engine.inputSolo;
      engine.setInputSolo(next);
      setInputSolo(next);
    }
  }, []);

  // ズーム操作
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(4.0, parseFloat((z + 0.3).toFixed(1))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(1.0, parseFloat((z - 0.3).toFixed(1))));
  }, []);

  const handleZoomFit = useCallback(() => {
    setZoom(1.0);
  }, []);

  return (
    <div className="daw-app cosmic-galaxy-theme">
      {/* 銀河宇宙の背景レイヤー */}
      <div className="galaxy-stars-background" />

      {/* 1. DAW トップバー (プロジェクト選択・LCD・トランスポート) */}
      <TransportBar
        currentSong={currentSong}
        playing={playing}
        position={position}
        duration={duration}
        bpm={bpm}
        beatOffset={beatOffset}
        loop={loop}
        metronome={metronome}
        metronomeVolume={metronomeVolume}
        currentBeat={currentBeat}
        isDownbeat={isDownbeat}
        masterVol={masterVol}
        masterLevel={masterLevel}
        zoom={zoom}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSeek={handleSeek}
        onToggleLoop={handleToggleLoop}
        onToggleMetronome={handleToggleMetronome}
        onMetronomeVolChange={handleMetronomeVolChange}
        onBpmChange={handleBpmChange}
        onBeatOffsetChange={handleBeatOffsetChange}
        onSetDownbeatHere={handleSetDownbeatHere}
        onMasterVolChange={handleMasterVolChange}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomFit={handleZoomFit}
      />

      {/* プロジェクトブラウザ モーダル (宇宙感あふれるプロジェクトランチャー) */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        songs={songs}
        currentSong={currentSong}
        isInitialLaunch={isInitialLaunch}
        onSelectSong={loadSong}
        onClose={() => setIsProjectModalOpen(false)}
      />

      {/* エラーアラートバナー */}
      {error && (
        <div className="daw-error-banner">
          <div className="error-content">
            <span className="error-glow-dot" />
            <span className="error-text">{error}</span>
          </div>
          <button
            type="button"
            className="error-close-btn"
            onClick={() => setError(null)}
          >
            閉じる
          </button>
        </div>
      )}

      {/* ローディングオーバーレイ (銀河の渦) */}
      {loading && (
        <div className="daw-loading-overlay cosmic-loader">
          <div className="loading-card cosmic-glass-card">
            <div className="cosmic-spinner" />
            <h3 className="loading-title">
              {currentSong ? `「${currentSong.title}」を宇宙展開中…` : 'プロジェクトを展開中…'}
            </h3>
            {loadingTrackName && (
              <p className="loading-sub">{loadingTrackName} をデコード同期中</p>
            )}
            <div className="loading-progress-bar">
              <div className="loading-progress-fill" style={{ width: `${loadPct}%` }} />
            </div>
            <span className="loading-pct">{loadPct}%</span>
          </div>
        </div>
      )}

      {/* 2. DAW タイムラインメインエリア */}
      <main className="daw-main-content">
        {!loading && stems.length === 0 && !currentSong && (
          <div className="daw-empty-state cosmic-empty-state">
            <div className="empty-nebula-orb">
              <IconProject size={40} className="empty-svg-icon" />
            </div>
            <h2 className="empty-title">COSMIC MOBILE DAW</h2>
            <p className="empty-desc">プロジェクトを選択して、マルチトラックの銀河を体験してください。</p>
            <button
              type="button"
              className="cosmic-launch-btn"
              onClick={() => setIsProjectModalOpen(true)}
            >
              プロジェクトを選択する
            </button>
          </div>
        )}

        {stems.length > 0 && (
          <DawTimeline
            engine={engineRef.current}
            stems={stems}
            duration={duration}
            position={position}
            bpm={bpm}
            beatOffset={beatOffset}
            loop={loop}
            loopStart={loopStart}
            loopEnd={loopEnd}
            zoom={zoom}
            onZoomChange={setZoom}
            playing={playing}
            inputActive={inputActive}
            inputGain={inputGain}
            inputPan={inputPan}
            inputMuted={inputMuted}
            inputSolo={inputSolo}
            inputLevel={inputLevel}
            stemLevels={stemLevels}
            onGainChange={handleGainChange}
            onPanChange={handlePanChange}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            onToggleInput={handleToggleInput}
            onInputGainChange={handleInputGainChange}
            onInputPanChange={handleInputPanChange}
            onInputMuteToggle={handleInputMuteToggle}
            onInputSoloToggle={handleInputSoloToggle}
            onSeek={handleSeek}
            onSetLoopRange={handleSetLoopRange}
          />
        )}
      </main>

      {/* 3. モバイル端末用ボトムトランスポートドック (スマホ縦持ちでボタン見切れを完全解消) */}
      <div className="daw-mobile-dock flex items-center justify-around px-2 py-2 bg-[#060914]/95 backdrop-blur-2xl border-t border-white/[0.12] shadow-[0_-10px_30px_rgba(0,0,0,0.8)] z-50">
        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="flat"
          className="w-10 h-10 min-w-0 p-0 bg-white/[0.06] border border-white/[0.1] text-slate-300 active:scale-90 active:bg-white/[0.15] transition-transform"
          title="先頭へ戻る (RTZ)"
          onClick={() => handleSeek(0)}
        >
          <IconRTZ size={16} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="flat"
          className="w-10 h-10 min-w-0 p-0 bg-white/[0.06] border border-white/[0.1] text-slate-300 active:scale-90 active:bg-white/[0.15] transition-transform"
          title="5秒戻る"
          onClick={() => handleSeek(Math.max(0, position - 5))}
        >
          <IconRewind size={16} />
        </Button>

        <Button
          isIconOnly
          size="lg"
          radius="full"
          className={`w-12 h-12 min-w-0 p-0 font-bold transition-all duration-200 active:scale-90 shadow-lg ${
            playing
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-black shadow-[0_0_25px_rgba(16,185,129,0.85)] ring-2 ring-emerald-300/80 animate-pulse'
              : 'bg-white/[0.12] text-white border border-white/[0.25] shadow-black/80 hover:bg-white/[0.2]'
          }`}
          title="再生 / 一時停止"
          onClick={playing ? handlePause : handlePlay}
        >
          {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
        </Button>

        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="flat"
          className="w-10 h-10 min-w-0 p-0 bg-white/[0.06] border border-white/[0.1] text-slate-300 active:scale-90 active:bg-white/[0.15] transition-transform"
          title="停止 (Stop)"
          onClick={handleStop}
        >
          <IconStop size={15} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          radius="full"
          variant="flat"
          className="w-10 h-10 min-w-0 p-0 bg-white/[0.06] border border-white/[0.1] text-slate-300 active:scale-90 active:bg-white/[0.15] transition-transform"
          title="5秒進む"
          onClick={() => handleSeek(Math.min(duration, position + 5))}
        >
          <IconFastForward size={16} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          radius="full"
          className={`w-10 h-10 min-w-0 p-0 border transition-all active:scale-90 ${
            loop
              ? 'bg-sky-500/25 text-sky-300 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
              : 'bg-white/[0.06] border-white/[0.1] text-slate-400 active:bg-white/[0.15]'
          }`}
          title="ループ再生"
          onClick={handleToggleLoop}
        >
          <IconLoop size={16} />
        </Button>

        <Button
          isIconOnly
          size="sm"
          radius="full"
          className={`w-10 h-10 min-w-0 p-0 border transition-all active:scale-90 ${
            metronome
              ? 'bg-purple-600/35 text-purple-200 border-purple-400 shadow-[0_0_14px_rgba(168,85,247,0.7)]'
              : 'bg-white/[0.06] border-white/[0.1] text-slate-400 active:bg-white/[0.15]'
          }`}
          title="メトロノーム"
          onClick={handleToggleMetronome}
        >
          <IconMetronome size={17} />
        </Button>
      </div>

      {/* 4. DAW フッターステータスバー */}
      <footer className="daw-status-bar">
        <div className="status-left">
          <span className="status-indicator online" />
          <span className="status-text">
            {currentSong ? `${currentSong.title} (${stems.length} Stems + 1 Input)` : 'Project Ready'}
          </span>
          <span className="status-bpm-tag">{bpm.toFixed(1)} BPM</span>
          <span className="status-sample-rate">
            {engineRef.current?.ctx.sampleRate
              ? `${(engineRef.current.ctx.sampleRate / 1000).toFixed(1)} kHz`
              : '48.0 kHz'}
          </span>
        </div>
        <div className="status-center">
          <span className="status-shortcut-hint">
            [Space] 再生/一時停止 · [Enter] 先頭へ · [M] メトロノーム · [L] ループ
          </span>
        </div>
        <div className="status-right">
          <span className="status-engine-badge">Cosmic Void Audio Engine</span>
        </div>
      </footer>
    </div>
  );
}
