import React, { useRef, useEffect } from 'react';
import { Button, Slider } from '@heroui/react';
import type { Stem } from '../engine';
import Waveform from './Waveform';
import PotKnob from './PotKnob';
import {
  IconVocal,
  IconDrums,
  IconBass,
  IconGuitar,
  IconPiano,
  IconOther,
} from './Icons';

interface TrackRowProps {
  stem: Stem;
  index: number;
  duration: number;
  position: number;
  timelineWidth: number;
  bpm: number;
  beatOffset: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  meterLevel: number;
  onGainChange: (stem: Stem, gain: number) => void;
  onPanChange: (stem: Stem, pan: number) => void;
  onMuteToggle: (stem: Stem) => void;
  onSoloToggle: (stem: Stem) => void;
  onSeek: (time: number) => void;
}

const ROLE_LABELS: Record<string, string> = {
  vocal: 'VOCAL',
  drums: 'DRUMS',
  bass: 'BASS',
  guitar: 'GUITAR',
  piano: 'PIANO',
  other: 'OTHER',
};

function renderInstrumentIcon(role?: string) {
  switch (role) {
    case 'vocal':
      return <IconVocal size={18} />;
    case 'drums':
      return <IconDrums size={18} />;
    case 'bass':
      return <IconBass size={18} />;
    case 'guitar':
      return <IconGuitar size={18} />;
    case 'piano':
      return <IconPiano size={18} />;
    default:
      return <IconOther size={18} />;
  }
}

function gainToDb(gain: number): string {
  if (gain <= 0.0001) return '-∞ dB';
  const db = 20 * Math.log10(gain);
  if (db > 0) return `+${db.toFixed(1)} dB`;
  return `${db.toFixed(1)} dB`;
}

export default function TrackRow({
  stem,
  index,
  duration,
  position,
  timelineWidth,
  bpm,
  beatOffset,
  loop,
  loopStart,
  loopEnd,
  meterLevel,
  onGainChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onSeek,
}: TrackRowProps) {
  const vuFillRef = useRef<HTMLDivElement>(null);

  // VUメーターのアニメーション (対数dBスケール)
  useEffect(() => {
    if (vuFillRef.current) {
      const pct = Math.min(100, Math.round(meterLevel * 100));
      vuFillRef.current.style.height = `${pct}%`;
      if (pct > 92) {
        vuFillRef.current.style.background = '#f43f5e';
        vuFillRef.current.style.boxShadow = '0 0 8px #f43f5e';
      } else if (pct > 75) {
        vuFillRef.current.style.background = '#eab308';
        vuFillRef.current.style.boxShadow = '0 0 6px #eab308';
      } else {
        vuFillRef.current.style.background = stem.color || '#10b981';
        vuFillRef.current.style.boxShadow = 'none';
      }
    }
  }, [meterLevel, stem.color]);

  const roleLabel = ROLE_LABELS[stem.role] || stem.role.toUpperCase();

  return (
    <div
      className={`daw-track-row flex flex-row items-stretch border-b border-white/[0.06] transition-colors relative ${
        stem.muted ? 'track-muted' : ''
      } ${stem.solo ? 'track-solo' : ''}`}
      style={{
        '--track-color': stem.color,
        background: `linear-gradient(90deg, ${stem.color}15 0%, rgba(7, 10, 20, 0.4) 180px, transparent 350px)`,
      } as React.CSSProperties}
    >
      {/* 1. トラックヘッダー (ミキサーチャンネルストリップ - レスポンシブ幅 & 固定ピン留め) */}
      <div className="daw-track-header sticky left-0 z-20 w-[180px] sm:w-[260px] min-w-[180px] sm:min-w-[260px] flex-shrink-0 bg-[#070a14]/95 backdrop-blur-xl border-r border-white/[0.1] p-2 flex flex-col justify-between select-none shadow-[2px_0_12px_rgba(0,0,0,0.5)]">
        {/* カラーアクセントバー */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
          style={{
            backgroundColor: stem.color,
            boxShadow: stem.solo ? `0 0 12px ${stem.color}` : `0 0 6px ${stem.color}40`,
          }}
        />

        {/* トラック名と楽器アイコン (スマホでも一目で判別可能なクリアデザイン) */}
        <div className="flex items-center justify-between pl-2 mb-1 gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                backgroundColor: `${stem.color}25`,
                border: `1px solid ${stem.color}70`,
                color: stem.color,
                boxShadow: `0 0 8px ${stem.color}35`,
              }}
            >
              {renderInstrumentIcon(stem.role)}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={`font-bold text-xs sm:text-sm text-slate-100 truncate tracking-wide leading-tight transition-opacity ${
                  stem.muted ? 'opacity-50' : 'opacity-100'
                }`}
                title={stem.info.name}
              >
                {stem.info.name}
              </span>
              <span
                className="text-[9px] font-mono font-semibold tracking-wider uppercase opacity-90"
                style={{ color: stem.color }}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <span
            className="hidden sm:inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]"
            style={{ color: stem.color }}
          >
            TRK {index + 1}
          </span>
        </div>

        {/* コントロール群 (MUTE, SOLO, ポットノブPAN, VOL, VU) */}
        <div className="flex items-center gap-1.5 pl-2">
          {/* MUTE / SOLO ボタン (プロ仕様 高視認性自照式LEDスイッチ) */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              isIconOnly
              size="sm"
              className={`w-7 h-[22px] min-w-0 p-0 text-[11px] font-black rounded transition-all duration-150 ${
                stem.muted
                  ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 text-white border-2 border-rose-200 shadow-[0_0_18px_rgba(244,63,94,1.0),inset_0_1px_2px_rgba(255,255,255,0.6)] scale-105 z-10'
                  : 'bg-[#220a10] border-2 border-rose-500/60 text-rose-400 hover:border-rose-400 hover:bg-rose-900/60 hover:text-white shadow-sm'
              }`}
              onClick={() => onMuteToggle(stem)}
              title="Mute (ミュート)"
            >
              M
            </Button>
            <Button
              isIconOnly
              size="sm"
              className={`w-7 h-[22px] min-w-0 p-0 text-[11px] font-black rounded transition-all duration-150 ${
                stem.solo
                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 border-2 border-amber-100 shadow-[0_0_20px_rgba(245,158,11,1.0),inset_0_1px_2px_rgba(255,255,255,0.8)] scale-105 z-10'
                  : 'bg-[#221808] border-2 border-amber-500/60 text-amber-400 hover:border-amber-400 hover:bg-amber-900/60 hover:text-white shadow-sm'
              }`}
              onClick={() => onSoloToggle(stem)}
              title="Solo (ソロ)"
            >
              S
            </Button>
          </div>

          {/* 🎛️ 回転式ポットノブ (PAN) */}
          <div className="flex-shrink-0">
            <PotKnob
              value={stem.pan}
              onChange={(newPan) => onPanChange(stem, newPan)}
              size={28}
              color={stem.color}
              title={`Pan: ${stem.pan === 0 ? 'Center' : stem.pan < 0 ? `L${Math.round(Math.abs(stem.pan) * 100)}` : `R${Math.round(stem.pan * 100)}`}`}
            />
          </div>

          {/* VOL スライダー & 数値 */}
          <div className="flex-1 flex flex-col justify-center min-w-0 pl-0.5">
            <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 leading-none mb-0.5">
              <span className="font-bold text-slate-500">VOL</span>
              <span
                className="cursor-pointer hover:text-white transition-colors"
                onDoubleClick={() => onGainChange(stem, 0.40)}
                title="ダブルクリックで基準値 (-8dB) リセット"
              >
                {gainToDb(stem.gain)}
              </span>
            </div>
            <Slider
              size="sm"
              step={0.01}
              minValue={0}
              maxValue={1.5}
              value={stem.gain}
              onChange={(v) => onGainChange(stem, Array.isArray(v) ? v[0] : v)}
              aria-label="Volume"
              className="w-full"
              classNames={{
                trackWrapper: 'h-3.5 flex items-center',
                track: 'h-1.5 bg-white/[0.1] my-auto',
                filler: 'bg-emerald-400',
                thumb: 'w-2.5 h-2.5 top-1/2 -translate-y-1/2 bg-emerald-200 border border-emerald-400 shadow-sm after:hidden',
              }}
            />
          </div>

          {/* リアルタイム対数dB ピークメーター */}
          <div
            className="w-2 sm:w-2.5 h-[48px] bg-black/60 rounded-sm overflow-hidden flex flex-col justify-end p-0.5 border border-white/[0.08] flex-shrink-0 ml-0.5"
            title="Track Peak Meter (対数dB)"
          >
            <div
              ref={vuFillRef}
              className="w-full rounded-[1px] transition-[height] duration-75 ease-out"
              style={{ height: '0%' }}
            />
          </div>
        </div>
      </div>

      {/* 2. 波形レーン (厳密な timelineWidth 固定で右端切れを根絶) */}
      <div
        className="daw-track-wave-lane flex-shrink-0 overflow-hidden relative bg-[#04060d]/60"
        style={{ width: `${timelineWidth}px` }}
      >
        <Waveform
          peaks={stem.peaks}
          color={stem.color}
          duration={duration}
          position={position}
          width={timelineWidth}
          height={88}
          bpm={bpm}
          beatOffset={beatOffset}
          loop={loop}
          loopStart={loopStart}
          loopEnd={loopEnd}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
}
