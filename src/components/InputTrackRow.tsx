import React, { useRef, useEffect } from 'react';
import { Button, Slider } from '@heroui/react';
import type { Engine } from '../engine';
import { ROLE_COLORS, gainToDb } from '../engine';
import { IconMic } from './Icons';
import PotKnob from './PotKnob';

interface InputTrackRowProps {
  engine: Engine | null;
  inputActive: boolean;
  inputGain: number;
  inputPan: number;
  inputMuted: boolean;
  inputSolo: boolean;
  timelineWidth: number;
  meterLevel: number;
  onToggleInput: () => void;
  onGainChange: (gain: number) => void;
  onPanChange: (pan: number) => void;
  onMuteToggle: () => void;
  onSoloToggle: () => void;
}

export default function InputTrackRow({
  engine,
  inputActive,
  inputGain,
  inputPan,
  inputMuted,
  inputSolo,
  timelineWidth,
  meterLevel,
  onToggleInput,
  onGainChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
}: InputTrackRowProps) {
  const vuFillRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(256)));

  // VUメーター更新 (対数dBスケール)
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
        vuFillRef.current.style.background = '#10b981';
        vuFillRef.current.style.boxShadow = 'none';
      }
    }
  }, [meterLevel]);

  // リアルタイムオシロスコープ波形の描画ループ
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const w = timelineWidth;
      const h = 88;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // 背景 (深宇宙のオブシディアン)
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, w, h);

      // センター基準線
      const midY = h / 2;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      if (inputActive && engine && engine.inputAnalyser && !inputMuted) {
        // リアルタイム音声波形
        engine.inputAnalyser.getByteTimeDomainData(waveDataRef.current);
        const data = waveDataRef.current;
        const sliceWidth = w / data.length;

        // 流体的なオーロラグロー
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#10b981';
        ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
        ctx.shadowBlur = 10;
        ctx.beginPath();

        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } else {
        // スタンバイ・ミュート状態のフラットライン
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();
      }

      // レーン境界線
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.strokeRect(0, 0, w, h);

      ctx.restore();
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [engine, inputActive, inputMuted, timelineWidth]);

  return (
    <div
      className={`daw-track-row flex flex-row items-stretch border-b border-white/[0.08] transition-colors relative ${
        inputMuted ? 'track-muted' : ''
      } ${inputSolo ? 'track-solo' : ''}`}
      style={{
        '--track-color': ROLE_COLORS.input,
        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 16, 14, 0.4) 180px, transparent 350px)',
      } as React.CSSProperties}
    >
      {/* 1. トラックヘッダー (ミキサーチャンネルストリップ - レスポンシブ幅 & 固定ピン留め) */}
      <div className="daw-track-header sticky left-0 z-20 w-[180px] sm:w-[260px] min-w-[180px] sm:min-w-[260px] flex-shrink-0 bg-[#071310]/95 backdrop-blur-xl border-r border-emerald-500/20 p-2 flex flex-col justify-between select-none shadow-[2px_0_12px_rgba(0,0,0,0.5)]">
        {/* カラーアクセントバー */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
          style={{
            backgroundColor: ROLE_COLORS.input,
            boxShadow: inputActive ? '0 0 12px rgba(16,185,129,0.85)' : 'none',
          }}
        />

        {/* トラック名とアーム/モニターボタン */}
        <div className="flex items-center justify-between pl-2 mb-1 gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.35)]">
              <IconMic size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={`font-bold text-xs sm:text-sm text-emerald-200 truncate tracking-wide leading-tight transition-opacity ${
                  inputMuted ? 'opacity-50' : 'opacity-100'
                }`}
              >
                AUDIO IN
              </span>
              <span className="text-[9px] font-mono font-semibold tracking-wider uppercase text-emerald-400/90">
                MIC / LIVE
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="flat"
            className={`text-[9px] h-5 px-1.5 font-mono uppercase tracking-wider transition-all min-w-0 ${
              inputActive
                ? 'bg-emerald-500 text-black font-bold shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse'
                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
            onClick={onToggleInput}
            title={inputActive ? 'モニタリング停止' : 'マイク入力を開始 (ヘッドホン推奨)'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                inputActive ? 'bg-black' : 'bg-emerald-400'
              }`}
            />
            {inputActive ? 'ON' : 'ARM'}
          </Button>
        </div>

        {/* コントロール群 (MUTE, SOLO, ポットノブPAN, GAIN, VU) */}
        <div className="flex items-center gap-1.5 pl-2">
          {/* MUTE / SOLO ボタン (プロ仕様 高視認性自照式LEDスイッチ) */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Button
              isIconOnly
              size="sm"
              className={`w-7 h-[22px] min-w-0 p-0 text-[11px] font-black rounded transition-all duration-150 ${
                inputMuted
                  ? 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 text-white border-2 border-rose-200 shadow-[0_0_18px_rgba(244,63,94,1.0),inset_0_1px_2px_rgba(255,255,255,0.6)] scale-105 z-10'
                  : 'bg-[#220a10] border-2 border-rose-500/60 text-rose-400 hover:border-rose-400 hover:bg-rose-900/60 hover:text-white shadow-sm'
              }`}
              onClick={onMuteToggle}
              title="Mute Input"
            >
              M
            </Button>
            <Button
              isIconOnly
              size="sm"
              className={`w-7 h-[22px] min-w-0 p-0 text-[11px] font-black rounded transition-all duration-150 ${
                inputSolo
                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 border-2 border-amber-100 shadow-[0_0_20px_rgba(245,158,11,1.0),inset_0_1px_2px_rgba(255,255,255,0.8)] scale-105 z-10'
                  : 'bg-[#221808] border-2 border-amber-500/60 text-amber-400 hover:border-amber-400 hover:bg-amber-900/60 hover:text-white shadow-sm'
              }`}
              onClick={onSoloToggle}
              title="Solo Input"
            >
              S
            </Button>
          </div>

          {/* 🎛️ 回転式ポットノブ (PAN) */}
          <div className="flex-shrink-0">
            <PotKnob
              value={inputPan}
              onChange={onPanChange}
              size={28}
              color="#10b981"
              title={`Input Pan: ${inputPan === 0 ? 'Center' : inputPan < 0 ? `L${Math.round(Math.abs(inputPan)*100)}` : `R${Math.round(inputPan*100)}`}`}
            />
          </div>

          {/* GAIN スライダー & 数値 */}
          <div className="flex-1 flex flex-col justify-center min-w-0 pl-0.5">
            <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 leading-none mb-0.5">
              <span className="font-bold text-emerald-400">GAIN</span>
              <span
                className="cursor-pointer hover:text-white transition-colors"
                onDoubleClick={() => onGainChange(1.0)}
                title="ダブルクリックでユニティ (0dB) リセット"
              >
                {gainToDb(inputGain)}
              </span>
            </div>
            <Slider
              size="sm"
              step={0.01}
              minValue={0}
              maxValue={2.0}
              value={inputGain}
              onChange={(v) => onGainChange(Array.isArray(v) ? v[0] : v)}
              aria-label="Input Gain"
              className="w-full"
              classNames={{
                trackWrapper: 'h-3.5 flex items-center',
                track: 'h-1.5 bg-white/[0.1] my-auto',
                filler: 'bg-emerald-500',
                thumb: 'w-2.5 h-2.5 top-1/2 -translate-y-1/2 bg-emerald-200 border border-emerald-400 shadow-sm after:hidden',
              }}
            />
          </div>

          {/* 入力対数dB ピークメーター */}
          <div
            className="w-2 sm:w-2.5 h-[48px] bg-black/60 rounded-sm overflow-hidden flex flex-col justify-end p-0.5 border border-emerald-500/20 flex-shrink-0 ml-0.5"
            title="Input Peak Meter (対数dB)"
          >
            <div
              ref={vuFillRef}
              className="w-full rounded-[1px] transition-[height] duration-75 ease-out"
              style={{ height: '0%' }}
            />
          </div>
        </div>
      </div>

      {/* 2. オシロスコープ波形レーン (厳密な timelineWidth 固定) */}
      <div
        className="daw-track-wave-lane flex-shrink-0 overflow-hidden relative bg-[#03060c] cursor-pointer"
        style={{ width: `${timelineWidth}px` }}
        onClick={!inputActive ? onToggleInput : undefined}
      >
        <canvas
          ref={canvasRef}
          className="daw-waveform-canvas block w-full h-[88px]"
          style={{ width: `${timelineWidth}px`, height: '88px' }}
        />
        {inputActive ? (
          <div className="absolute top-2 right-3 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE MONITOR (DIRECT ZERO-LATENCY)
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-emerald-500/50 text-xs font-mono tracking-wider gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/40" />
            クリックしてマイク入力を開始 (超低遅延ダイレクトモニター / イヤホン推奨)
          </div>
        )}
      </div>
    </div>
  );
}
