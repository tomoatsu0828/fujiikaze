import React, { useRef, useEffect, useCallback } from 'react';
import type { Peak } from '../types';

interface WaveformProps {
  peaks: Peak[];
  color: string;
  duration: number;
  position: number;
  width: number;
  height?: number;
  bpm: number;
  beatOffset?: number;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  onSeek: (time: number) => void;
}

export default function Waveform({
  peaks,
  color,
  duration,
  position,
  width,
  height = 70,
  bpm,
  beatOffset = 0,
  loop = false,
  loopStart = 0,
  loopEnd = 0,
  onSeek,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);

  const timeToPx = useCallback(
    (t: number) => (duration > 0 ? (Math.max(0, Math.min(t, duration)) / duration) * width : 0),
    [duration, width]
  );

  const pxToTime = useCallback(
    (px: number) => (width > 0 ? Math.max(0, Math.min(duration, (px / width) * duration)) : 0),
    [duration, width]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const actualWidth = Math.round(width * dpr);
    const actualHeight = Math.round(height * dpr);

    if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
      canvas.width = actualWidth;
      canvas.height = actualHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. 背景グリッド (深遠なオブシディアン)
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, width, height);

    // 2. ループ範囲ハイライト (淡いアンバーのオーロラ)
    if (loop && loopEnd > loopStart && duration > 0) {
      const lStartPx = timeToPx(loopStart);
      const lEndPx = timeToPx(loopEnd);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
      ctx.fillRect(lStartPx, 0, Math.max(2, lEndPx - lStartPx), height);
    }

    // 3. 小節グリッド線 (Bar Grid - beatOffsetでダウンビート位置同期)
    if (bpm > 0 && duration > 0) {
      const secondsPerBeat = 60 / bpm;
      const secondsPerBar = secondsPerBeat * 4;
      const totalBars = Math.ceil((duration - beatOffset) / secondsPerBar) + 1;

      ctx.lineWidth = 1;
      for (let b = 0; b <= totalBars; b++) {
        const t = beatOffset + b * secondsPerBar;
        if (t < 0) continue;
        if (t > duration) break;
        const x = Math.round(timeToPx(t));

        // 小節線
        ctx.strokeStyle = b === 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.07)';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();

        // 拍線 (細線)
        if (width / totalBars > 45) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
          for (let beat = 1; beat < 4; beat++) {
            const beatX = Math.round(timeToPx(t + beat * secondsPerBeat));
            if (beatX < width) {
              ctx.beginPath();
              ctx.moveTo(beatX + 0.5, 0);
              ctx.lineTo(beatX + 0.5, height);
              ctx.stroke();
            }
          }
        }
      }
    }

    // センター基準線
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // 4. オーディオ波形描画 (Fluid & Glowing)
    const n = peaks.length;
    if (n > 0) {
      const playheadPx = timeToPx(position);
      const step = width / n;

      for (let i = 0; i < n; i++) {
        const x = i * step;
        const p = peaks[i];
        const halfAmp = (height / 2) * 0.88;
        const top = midY - p.max * halfAmp;
        const bot = midY - p.min * halfAmp;
        const barH = Math.max(1, bot - top);

        if (x <= playheadPx) {
          // 再生済み: 鮮やかな発光
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.95;
        } else {
          // 未再生: シックなダークトーン
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.3;
        }

        ctx.fillRect(Math.round(x), top, Math.max(1, Math.ceil(step)), barH);
      }
      ctx.globalAlpha = 1.0;
    }

    // レーン枠線
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.strokeRect(0, 0, width, height);

    ctx.restore();
  }, [peaks, color, duration, position, width, height, bpm, beatOffset, loop, loopStart, loopEnd, timeToPx]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(pxToTime(x));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(pxToTime(x));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  };

  return (
    <div className="daw-waveform-container" style={{ width: `${width}px`, height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        className="daw-waveform-canvas"
        style={{ width: `${width}px`, height: `${height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
