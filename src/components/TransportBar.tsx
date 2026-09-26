import React, { useState, useEffect, useRef } from 'react';
import { Button, Slider, Chip } from '@heroui/react';
import type { SongInfo } from '../engine';
import { fmtTime, fmtBarsBeats, gainToDb } from '../engine';
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
  IconZoomIn,
  IconZoomOut,
  IconZoomFit,
} from './Icons';

interface TransportBarProps {
  currentSong: SongInfo | null;
  playing: boolean;
  position: number;
  duration: number;
  bpm: number;
  beatOffset: number;
  loop: boolean;
  metronome: boolean;
  metronomeVolume: number;
  currentBeat: number; // 0..3
  isDownbeat: boolean;
  masterVol: number;
  masterLevel: number;
  zoom: number;
  onOpenProjectModal: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onMetronomeVolChange: (vol: number) => void;
  onBpmChange: (bpm: number) => void;
  onBeatOffsetChange: (offset: number) => void;
  onSetDownbeatHere?: () => void;
  onMasterVolChange: (vol: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
}

export default function TransportBar({
  currentSong,
  playing,
  position,
  duration,
  bpm,
  beatOffset,
  loop,
  metronome,
  metronomeVolume,
  currentBeat,
  isDownbeat,
  masterVol,
  masterLevel,
  zoom,
  onOpenProjectModal,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onToggleLoop,
  onToggleMetronome,
  onMetronomeVolChange,
  onBpmChange,
  onBeatOffsetChange,
  onSetDownbeatHere,
  onMasterVolChange,
  onZoomIn,
  onZoomOut,
  onZoomFit,
}: TransportBarProps) {
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const meterLRef = useRef<HTMLDivElement>(null);
  const meterRRef = useRef<HTMLDivElement>(null);

  // 初回ユーザー向けプロジェクト切り替え案内
  const [showProjectHint, setShowProjectHint] = useState(() => {
    return localStorage.getItem('mobiledaw_hint_dismissed') !== 'true';
  });

  const handleDismissHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProjectHint(false);
    localStorage.setItem('mobiledaw_hint_dismissed', 'true');
  };

  const handleTriggerProject = () => {
    setShowProjectHint(false);
    localStorage.setItem('mobiledaw_hint_dismissed', 'true');
    onOpenProjectModal();
  };

  // マスターLEDメーターの更新 (対数dBスケール)
  useEffect(() => {
    const levelL = Math.min(1, masterLevel * 1.05);
    const levelR = Math.min(1, masterLevel * (0.95 + Math.sin(position * 5) * 0.05));

    if (meterLRef.current) {
      const pctL = Math.round(levelL * 100);
      meterLRef.current.style.width = `${pctL}%`;
      meterLRef.current.style.background =
        pctL > 90 ? '#f43f5e' : pctL > 72 ? '#eab308' : '#10b981';
    }
    if (meterRRef.current) {
      const pctR = Math.round(levelR * 100);
      meterRRef.current.style.width = `${pctR}%`;
      meterRRef.current.style.background =
        pctR > 90 ? '#f43f5e' : pctR > 72 ? '#eab308' : '#10b981';
    }
  }, [masterLevel, position]);

  // Tap Tempo 機能
  const handleTapTempo = () => {
    const now = performance.now();
    const newTaps = [...tapTimes.filter((t) => now - t < 3000), now];
    setTapTimes(newTaps);
    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        onBpmChange(calculatedBpm);
      }
    }
  };

  const { text: barsBeatsText } = fmtBarsBeats(position, bpm, 4, beatOffset);
  const bpmDisplay = bpm.toFixed(bpm % 1 === 0 ? 0 : 1);

  return (
    <header className="daw-transport-bar bg-[#060813]/95 backdrop-blur-xl border-b border-white/[0.08] px-3 py-2 flex items-center justify-between gap-2.5 select-none relative z-50 shadow-lg shadow-black/40 overflow-visible">
      {/* 1. 高視認性プロジェクトスイッチャー + 初回案内コーチマーク */}
      <div className="relative flex items-center flex-shrink-0 z-50">
        <Button
          variant="bordered"
          size="sm"
          className="bg-white/[0.04] border-white/[0.12] hover:border-cyan-400/50 hover:bg-cyan-500/[0.06] text-white px-2.5 py-1.5 h-auto transition-all shadow-sm group"
          onClick={handleTriggerProject}
          title="プロジェクトを切り替える (クリックで一覧表示)"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform flex-shrink-0">
              <IconProject size={16} />
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[8px] font-mono tracking-widest text-cyan-400/80 uppercase">
                PROJECT
              </span>
              <span className="text-xs font-bold text-slate-100 tracking-wide truncate max-w-[100px] sm:max-w-none">
                {currentSong ? currentSong.title : 'プロジェクトを選択'}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-0.5">
              <Chip
                size="sm"
                variant="flat"
                className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[9px] font-mono h-4 px-1"
              >
                {bpmDisplay}
              </Chip>
              <span className="text-[10px] text-slate-400">▾</span>
            </div>
          </div>
        </Button>

        {/* 初回ユーザー向けガイダンス吹き出し (最前面 z-[100] でタイムラインの上に完全浮揚) */}
        {showProjectHint && (
          <div
            className="absolute left-0 top-full mt-2.5 z-[100] animate-bounce cursor-pointer w-[310px] sm:w-[360px] max-w-[calc(100vw-16px)] drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)]"
            onClick={handleTriggerProject}
          >
            <div className="relative bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border border-violet-400/70 rounded-xl p-3 shadow-[0_0_30px_rgba(139,92,246,0.7)] backdrop-blur-2xl flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rotate-45 bg-violet-950 border-t border-l border-violet-400/70 absolute -top-1.5 left-6" />
              <span className="text-violet-300 text-lg flex-shrink-0 animate-pulse">✦</span>
              <div className="flex flex-col flex-1 min-w-0 pr-1">
                <span className="text-xs font-bold text-white tracking-wide leading-snug">
                  ここをタップしてプロジェクト切替！
                </span>
                <span className="text-[10px] text-slate-300 leading-tight mt-0.5">
                  全5曲のマルチトラックをいつでも選べます
                </span>
              </div>
              <Button
                size="sm"
                variant="flat"
                className="bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs h-7 px-3 flex-shrink-0 shadow-md"
                onClick={handleDismissHint}
              >
                OK
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 2. DAW トランスポート LCD スクリーン (深宇宙・サイバー液晶発光) */}
      <div className="bg-[#03050c]/90 border border-cyan-500/20 rounded-xl px-2.5 py-1 flex items-center gap-2 sm:gap-3.5 shadow-[inset_0_0_15px_rgba(0,242,254,0.05)] flex-shrink-0">
        {/* 小節・拍表示 (Bars & Beats - ダウンビート同期済み) */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-mono tracking-widest text-slate-400">BAR / BEAT</span>
          <span
            className={`font-mono text-xs sm:text-sm tracking-wider font-bold transition-colors ${
              playing && isDownbeat
                ? 'text-cyan-300 drop-shadow-[0_0_8px_#00f2fe]'
                : 'text-cyan-400'
            }`}
            title="ダウンビート同期済みの小節・拍・16分音符"
          >
            {barsBeatsText}
          </span>
        </div>

        <div className="hidden sm:block w-[1px] h-6 bg-white/[0.08]" />

        {/* タイムコード表示 (スマホではスペース節約で非表示またはコンパクト) */}
        <div className="hidden sm:flex flex-col items-center">
          <span className="text-[8px] font-mono tracking-widest text-slate-400">TIME</span>
          <div className="font-mono text-xs sm:text-sm tracking-wider font-semibold text-slate-200">
            <span>{fmtTime(position)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-slate-400 text-xs">{fmtTime(duration)}</span>
          </div>
        </div>

        <div className="w-[1px] h-6 bg-white/[0.08]" />

        {/* BPM & テンポ設定 */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-mono tracking-widest text-slate-400">TEMPO</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs sm:text-sm font-bold text-amber-400">{bpmDisplay}</span>
            <span className="text-[8px] font-mono text-slate-400">BPM</span>
            <div className="flex flex-col gap-0.5 ml-0.5">
              <button
                type="button"
                className="w-3 h-2 bg-white/[0.08] hover:bg-white/[0.2] text-[7px] flex items-center justify-center rounded-[2px] text-slate-300"
                title="BPM +0.5"
                onClick={() => onBpmChange(Math.min(240, parseFloat((bpm + 0.5).toFixed(2))))}
              >
                ▲
              </button>
              <button
                type="button"
                className="w-3 h-2 bg-white/[0.08] hover:bg-white/[0.2] text-[7px] flex items-center justify-center rounded-[2px] text-slate-300"
                title="BPM -0.5"
                onClick={() => onBpmChange(Math.max(40, parseFloat((bpm - 0.5).toFixed(2))))}
              >
                ▼
              </button>
            </div>
            <Button
              size="sm"
              variant="flat"
              className="h-4 px-1 min-w-0 text-[8px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 ml-0.5"
              onClick={handleTapTempo}
              title="タップしてテンポを自動計測"
            >
              TAP
            </Button>
          </div>
        </div>

        {/* ダウンビート同期設定 (PC/タブレット用) */}
        <div className="hidden md:flex flex-col items-center pl-2 border-l border-white/[0.08]">
          <span className="text-[8px] font-mono tracking-widest text-slate-400">BEAT SYNC</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs font-semibold text-violet-300">
              {(beatOffset * 1000).toFixed(0)}ms
            </span>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                className="w-3 h-2 bg-white/[0.08] hover:bg-white/[0.2] text-[7px] flex items-center justify-center rounded-[2px] text-slate-300"
                title="ダウンビート +20ms"
                onClick={() => onBeatOffsetChange(parseFloat((beatOffset + 0.02).toFixed(3)))}
              >
                ▲
              </button>
              <button
                type="button"
                className="w-3 h-2 bg-white/[0.08] hover:bg-white/[0.2] text-[7px] flex items-center justify-center rounded-[2px] text-slate-300"
                title="ダウンビート -20ms"
                onClick={() =>
                  onBeatOffsetChange(Math.max(0, parseFloat((beatOffset - 0.02).toFixed(3))))
                }
              >
                ▼
              </button>
            </div>
            {onSetDownbeatHere && (
              <Button
                size="sm"
                variant="flat"
                className="h-4 px-1.5 min-w-0 text-[8px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-400/40 hover:bg-violet-500/30"
                onClick={onSetDownbeatHere}
                title="現在再生ヘッドの位置を「第1小節の第1拍 (Bar 1 Beat 1)」に同期設定します"
              >
                SET BEAT 1
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 3. トランスポートボタン群 & メトロノーム (PC/タブレット用: スマホはボトムドックで操作) */}
      <div className="hidden md:flex items-center gap-1.5">
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"
          title="Return to Zero (先頭へ戻る / Enter)"
          onClick={() => onSeek(0)}
        >
          <IconRTZ size={13} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"
          title="5秒戻る (←)"
          onClick={() => onSeek(Math.max(0, position - 5))}
        >
          <IconRewind size={13} />
        </Button>
        <Button
          isIconOnly
          size="md"
          className={`w-9 h-9 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full font-bold transition-all shadow-md ${
            playing
              ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)] animate-pulse'
              : 'bg-white/[0.1] text-white hover:bg-white/[0.2] border border-white/[0.15]'
          }`}
          title="再生 / 一時停止 (Space)"
          onClick={playing ? onPause : onPlay}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"
          title="停止 (Stop)"
          onClick={onStop}
        >
          <IconStop size={13} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-colors"
          title="5秒進む (→)"
          onClick={() => onSeek(Math.min(duration, position + 5))}
        >
          <IconFastForward size={13} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          className={`w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full transition-all ${
            loop
              ? 'bg-sky-500 text-white shadow-[0_0_10px_rgba(56,189,248,0.6)]'
              : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.12]'
          }`}
          title="Cycle / Loop (ループ再生 / L)"
          onClick={onToggleLoop}
        >
          <IconLoop size={13} />
        </Button>

        {/* ⏱️ メトロノームモジュール */}
        <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/[0.08] ml-1">
          <Button
            isIconOnly
            size="sm"
            className={`w-7 h-7 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full transition-all ${
              metronome
                ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.7)]'
                : 'bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12]'
            }`}
            title="メトロノーム ON/OFF (Mキー)"
            onClick={onToggleMetronome}
          >
            <IconMetronome size={15} />
          </Button>

          {/* 4拍インジケーター */}
          <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-black/40 border border-white/[0.06]">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                  playing && metronome && currentBeat === b
                    ? b === 0 && isDownbeat
                      ? 'bg-cyan-300 shadow-[0_0_8px_#00f2fe] scale-125'
                      : 'bg-amber-400 shadow-[0_0_6px_#fbbf24] scale-110'
                    : 'bg-white/[0.12]'
                }`}
              />
            ))}
          </div>

          {/* メトロノーム音量スライダー */}
          <div className="flex items-center gap-1 w-20 pl-1" title="メトロノーム音量">
            <span className="text-[7px] font-mono text-purple-400 font-bold">VOL</span>
            <Slider
              size="sm"
              step={0.05}
              minValue={0}
              maxValue={1.5}
              value={metronomeVolume}
              onChange={(v) => onMetronomeVolChange(Array.isArray(v) ? v[0] : v)}
              aria-label="Metronome Volume"
              className="max-w-[55px]"
              classNames={{
                trackWrapper: 'h-4 flex items-center',
                track: 'h-1 bg-white/[0.1] my-auto',
                filler: 'bg-purple-500',
                thumb: 'w-2 h-2 top-1/2 -translate-y-1/2 bg-purple-200 border border-purple-400 shadow-sm after:hidden',
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. ズームコントロール (PC用) */}
      <div className="hidden lg:flex items-center gap-1 px-1.5 border-l border-white/[0.08]">
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-6 h-6 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.05] text-slate-400 hover:text-white"
          title="波形を縮小"
          onClick={onZoomOut}
          disabled={zoom <= 1.0}
        >
          <IconZoomOut size={11} />
        </Button>
        <Button
          size="sm"
          variant="flat"
          className="h-6 px-1.5 text-[9px] font-mono rounded-full bg-white/[0.05] text-slate-300 hover:text-white"
          title="画面幅にフィット"
          onClick={onZoomFit}
        >
          FIT
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          className="w-6 h-6 min-w-0 p-0 !inline-flex !items-center !justify-center rounded-full bg-white/[0.05] text-slate-400 hover:text-white"
          title="波形を拡大"
          onClick={onZoomIn}
          disabled={zoom >= 4.0}
        >
          <IconZoomIn size={11} />
        </Button>
      </div>

      {/* 5. マスターミキサー & デュアルLEDメーター (PC/タブレット用) */}
      <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/[0.08]">
        <div className="flex flex-col">
          <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 mb-0.5">
            <span className="font-bold text-slate-300">MASTER</span>
            <span>{gainToDb(masterVol)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Slider
              size="sm"
              step={0.01}
              minValue={0}
              maxValue={1.5}
              value={masterVol}
              onChange={(v) => onMasterVolChange(Array.isArray(v) ? v[0] : v)}
              aria-label="Master Volume"
              className="w-20"
              classNames={{
                trackWrapper: 'h-4 flex items-center',
                track: 'h-1.5 bg-white/[0.1] my-auto',
                filler: 'bg-sky-400',
                thumb: 'w-2.5 h-2.5 top-1/2 -translate-y-1/2 bg-sky-200 border border-sky-400 shadow-sm after:hidden',
              }}
            />
            {/* ステレオデュアルLEDメーター */}
            <div
              className="w-12 h-3.5 bg-black/60 rounded flex flex-col justify-center gap-0.5 p-0.5 border border-white/[0.08]"
              title="Master Stereo Peak Meter (対数dB)"
            >
              <div className="w-full h-1 bg-white/[0.06] rounded-sm overflow-hidden">
                <div
                  ref={meterLRef}
                  className="h-full transition-[width] duration-75 ease-out"
                  style={{ width: '0%' }}
                />
              </div>
              <div className="w-full h-1 bg-white/[0.06] rounded-sm overflow-hidden">
                <div
                  ref={meterRRef}
                  className="h-full transition-[width] duration-75 ease-out"
                  style={{ width: '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
