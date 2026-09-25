import React, { useRef, useCallback } from 'react';
import { fmtTime } from '../engine';

interface RulerProps {
  duration: number;
  bpm: number;
  beatOffset: number;
  position: number;
  width: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  onSeek: (time: number) => void;
  onSetLoopRange: (start: number, end: number) => void;
}

export default function Ruler({
  duration,
  bpm,
  beatOffset = 0,
  position,
  width,
  loop,
  loopStart,
  loopEnd,
  onSeek,
  onSetLoopRange,
}: RulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'seek' | 'loop-start' | 'loop-end' | 'loop-bar' | null>(null);
  const dragStartRef = useRef<{ clientX: number; startSec: number; endSec: number }>({
    clientX: 0,
    startSec: 0,
    endSec: 0,
  });

  const secondsPerBeat = 60 / Math.max(20, bpm);
  const secondsPerBar = secondsPerBeat * 4;
  const totalBars = duration > 0 ? Math.ceil((duration - beatOffset) / secondsPerBar) + 2 : 16;

  // 1小節あたりのピクセル幅
  const barPx = (secondsPerBar / (duration || 1)) * width;

  // 小節番号のステップ（間引き: ラベル文字が重ならないよう最低40px間隔を厳密保証）
  let barStep = 1;
  if (barPx < 5) barStep = 32;
  else if (barPx < 12) barStep = 16;
  else if (barPx < 25) barStep = 8;
  else if (barPx < 50) barStep = 4;
  else if (barPx < 90) barStep = 2;

  const timeToPx = useCallback(
    (t: number) => (duration > 0 ? (Math.max(0, Math.min(t, duration)) / duration) * width : 0),
    [duration, width]
  );

  const pxToTime = useCallback(
    (px: number) => (width > 0 ? Math.max(0, Math.min(duration, (px / width) * duration)) : 0),
    [duration, width]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rulerRef.current || duration <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickTime = pxToTime(clickX);

    const loopStartPx = timeToPx(loopStart);
    const loopEndPx = timeToPx(loopEnd);

    if (Math.abs(clickX - loopStartPx) < 12) {
      draggingRef.current = 'loop-start';
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (Math.abs(clickX - loopEndPx) < 12) {
      draggingRef.current = 'loop-end';
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (clickX > loopStartPx && clickX < loopEndPx && e.shiftKey) {
      draggingRef.current = 'loop-bar';
      dragStartRef.current = { clientX: e.clientX, startSec: loopStart, endSec: loopEnd };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      draggingRef.current = 'seek';
      onSeek(clickTime);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !rulerRef.current || duration <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curTime = pxToTime(curX);

    if (draggingRef.current === 'seek') {
      onSeek(curTime);
    } else if (draggingRef.current === 'loop-start') {
      const newStart = Math.min(curTime, loopEnd - 0.5);
      onSetLoopRange(Math.max(0, newStart), loopEnd);
    } else if (draggingRef.current === 'loop-end') {
      const newEnd = Math.max(curTime, loopStart + 0.5);
      onSetLoopRange(loopStart, Math.min(duration, newEnd));
    } else if (draggingRef.current === 'loop-bar') {
      const dt = ((e.clientX - dragStartRef.current.clientX) / width) * duration;
      const len = dragStartRef.current.endSec - dragStartRef.current.startSec;
      let newStart = dragStartRef.current.startSec + dt;
      let newEnd = newStart + len;
      if (newStart < 0) {
        newStart = 0;
        newEnd = len;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - len;
      }
      onSetLoopRange(newStart, newEnd);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
  };

  // 小節目盛りの生成 (beatOffset を考慮して第1小節の頭を揃える)
  const barMarks = [];
  for (let b = 0; b <= totalBars; b++) {
    const t = beatOffset + b * secondsPerBar;
    if (t < 0) continue;
    if (t > duration && b > 0) break;
    const leftPx = timeToPx(t);
    const isNumbered = b % barStep === 0;

    barMarks.push(
      <div
        key={`bar-${b}`}
        className={`ruler-bar-tick ${isNumbered ? 'major' : 'minor'} ${b === 0 ? 'downbeat' : ''}`}
        style={{ left: `${leftPx}px` }}
      >
        {isNumbered && (
          <span className={`ruler-bar-num ${b === 0 ? 'downbeat-num' : ''}`}>
            {b + 1}
          </span>
        )}
      </div>
    );

    // 拍目盛り (細線)
    if (barPx > 48) {
      for (let beat = 1; beat < 4; beat++) {
        const beatTime = t + beat * secondsPerBeat;
        if (beatTime > duration) break;
        const beatPx = timeToPx(beatTime);
        barMarks.push(
          <div
            key={`beat-${b}-${beat}`}
            className="ruler-beat-tick"
            style={{ left: `${beatPx}px` }}
          />
        );
      }
    }
  }

  const loopStartPx = timeToPx(loopStart);
  const loopEndPx = timeToPx(loopEnd);
  const playheadPx = timeToPx(position);

  return (
    <div
      ref={rulerRef}
      className={`daw-ruler ${loop ? 'loop-active' : ''}`}
      style={{ width: `${width}px` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* ループ範囲ハイライトバー */}
      {duration > 0 && loopEnd > loopStart && (
        <div
          className={`ruler-loop-region ${loop ? 'enabled' : 'disabled'}`}
          style={{
            left: `${loopStartPx}px`,
            width: `${Math.max(4, loopEndPx - loopStartPx)}px`,
          }}
          title={`ループ区間: ${fmtTime(loopStart)} - ${fmtTime(loopEnd)} (Shift+ドラッグで移動)`}
        >
          <div className="loop-handle left" title="ループ開始" />
          <div className="loop-bar-stripe" />
          <div className="loop-handle right" title="ループ終了" />
        </div>
      )}

      {/* 小節・拍 目盛り */}
      <div className="ruler-ticks-layer">{barMarks}</div>

      {/* 再生ヘッドのルーラーマーカー */}
      <div
        className="ruler-playhead-cursor"
        style={{ transform: `translateX(${playheadPx}px)` }}
      >
        <div className="ruler-cursor-badge">{fmtTime(position)}</div>
        <div className="ruler-cursor-pin" />
      </div>
    </div>
  );
}
