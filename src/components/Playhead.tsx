import React, { useRef, useEffect } from 'react';

interface PlayheadProps {
  duration: number;
  position: number;
  timelineWidth: number;
  onSeek: (time: number) => void;
}

export default function Playhead({ duration, position, timelineWidth, onSeek }: PlayheadProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const leftPx = duration > 0 ? (Math.max(0, Math.min(position, duration)) / duration) * timelineWidth : 0;

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.style.transform = `translateX(${leftPx}px)`;
    }
  }, [leftPx]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || duration <= 0 || !lineRef.current) return;
    const parent = lineRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const headerOffset = parseFloat(window.getComputedStyle(lineRef.current).left) || 0;
    const x = e.clientX - rect.left - headerOffset;
    const newTime = Math.max(0, Math.min(duration, (x / timelineWidth) * duration));
    onSeek(newTime);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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
    <div
      ref={lineRef}
      className="daw-playhead-line"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="再生ヘッド (ドラッグしてシーク)"
    >
      <div className="playhead-glow" />
    </div>
  );
}
