import React, { useRef, useState, useEffect } from 'react';
import type { Engine, Stem } from '../engine';
import Ruler from './Ruler';
import TrackRow from './TrackRow';
import InputTrackRow from './InputTrackRow';
import Playhead from './Playhead';

interface DawTimelineProps {
  engine: Engine | null;
  stems: Stem[];
  duration: number;
  position: number;
  bpm: number;
  beatOffset: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  zoom: number;
  playing: boolean;
  inputActive: boolean;
  inputGain: number;
  inputPan: number;
  inputMuted: boolean;
  inputSolo: boolean;
  inputLevel: number;
  stemLevels: number[];
  onZoomChange?: (newZoom: number) => void;
  onGainChange: (stem: Stem, gain: number) => void;
  onPanChange: (stem: Stem, pan: number) => void;
  onMuteToggle: (stem: Stem) => void;
  onSoloToggle: (stem: Stem) => void;
  onToggleInput: () => void;
  onInputGainChange: (gain: number) => void;
  onInputPanChange: (pan: number) => void;
  onInputMuteToggle: () => void;
  onInputSoloToggle: () => void;
  onSeek: (time: number) => void;
  onSetLoopRange: (start: number, end: number) => void;
}

export default function DawTimeline({
  engine,
  stems,
  duration,
  position,
  bpm,
  beatOffset,
  loop,
  loopStart,
  loopEnd,
  zoom,
  playing,
  inputActive,
  inputGain,
  inputPan,
  inputMuted,
  inputSolo,
  inputLevel,
  stemLevels,
  onZoomChange,
  onGainChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onToggleInput,
  onInputGainChange,
  onInputPanChange,
  onInputMuteToggle,
  onInputSoloToggle,
  onSeek,
  onSetLoopRange,
}: DawTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(800);

  // コンテナの幅を追跡
  useEffect(() => {
    const updateWidth = () => {
      if (scrollAreaRef.current) {
        setViewportWidth(scrollAreaRef.current.clientWidth || 800);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // スマホ用ピンチズーム操作 (2本指での時間軸拡大縮小)
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el || !onZoomChange) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistRef.current = Math.hypot(dx, dy);
        touchStartZoomRef.current = zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDistRef.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / Math.max(1, touchStartDistRef.current);
        const newZoom = Math.max(1, Math.min(6, touchStartZoomRef.current * scale));
        onZoomChange(parseFloat(newZoom.toFixed(2)));
      }
    };

    const handleTouchEnd = () => {
      touchStartDistRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoom, onZoomChange]);

  // 波形が表示される有効幅 (全体幅からトラックヘッダー幅を差し引いた実効幅)
  const isMobile = viewportWidth < 768;
  const headerWidth = isMobile ? 180 : 260;
  const availableWaveWidth = Math.max(300, viewportWidth - headerWidth);
  const timelineWidth = Math.max(availableWaveWidth, Math.round(availableWaveWidth * zoom));

  // 再生ヘッドの自動スクロール追従
  useEffect(() => {
    if (!playing || !scrollAreaRef.current || duration <= 0) return;
    const scrollEl = scrollAreaRef.current;
    const playheadPx = (position / duration) * timelineWidth;
    const scrollLeft = scrollEl.scrollLeft;
    const scrollWidth = scrollEl.clientWidth - headerWidth;

    // 再生ヘッドが画面右端 85% を超えたらスクロール
    if (playheadPx > scrollLeft + scrollWidth * 0.85) {
      scrollEl.scrollLeft = playheadPx - scrollWidth * 0.2;
    } else if (playheadPx < scrollLeft) {
      scrollEl.scrollLeft = Math.max(0, playheadPx - scrollWidth * 0.1);
    }
  }, [playing, position, duration, timelineWidth, headerWidth]);

  return (
    <div ref={containerRef} className="daw-timeline-wrapper">
      {/* タイムラインスクロールエリア */}
      <div ref={scrollAreaRef} className="daw-timeline-scroll-area">
        <div
          className="daw-timeline-canvas-container"
          style={{
            width: `calc(var(--track-header-width) + ${timelineWidth}px)`,
            minWidth: '100%',
          }}
        >
          {/* 1. 小節 & 時間ルーラー (ダウンビート同期) */}
          <div className="daw-ruler-sticky-header">
            <div className="daw-header-corner">
              <span className="corner-label">TRACKS ({stems.length + 1})</span>
            </div>
            <div className="daw-ruler-track-lane" style={{ width: `${timelineWidth}px` }}>
              <Ruler
                duration={duration}
                bpm={bpm}
                beatOffset={beatOffset}
                position={position}
                width={timelineWidth}
                loop={loop}
                loopStart={loopStart}
                loopEnd={loopEnd}
                onSeek={onSeek}
                onSetLoopRange={onSetLoopRange}
              />
            </div>
          </div>

          {/* 2. トラック行リスト */}
          <div className="daw-tracks-body">
            {/* 再生ヘッド (全トラックを貫通して描画) */}
            {duration > 0 && (
              <Playhead
                duration={duration}
                position={position}
                timelineWidth={timelineWidth}
                onSeek={onSeek}
              />
            )}

            {/* 各ステムトラック */}
            {stems.map((stem, index) => (
              <TrackRow
                key={stem.id}
                stem={stem}
                index={index}
                duration={duration}
                position={position}
                timelineWidth={timelineWidth}
                bpm={bpm}
                beatOffset={beatOffset}
                loop={loop}
                loopStart={loopStart}
                loopEnd={loopEnd}
                meterLevel={stemLevels[index] || 0}
                onGainChange={onGainChange}
                onPanChange={onPanChange}
                onMuteToggle={onMuteToggle}
                onSoloToggle={onSoloToggle}
                onSeek={onSeek}
              />
            ))}

            {/* 常設の入力用トラック (AUDIO INPUT TRACK) */}
            <InputTrackRow
              engine={engine}
              inputActive={inputActive}
              inputGain={inputGain}
              inputPan={inputPan}
              inputMuted={inputMuted}
              inputSolo={inputSolo}
              timelineWidth={timelineWidth}
              meterLevel={inputLevel}
              onToggleInput={onToggleInput}
              onGainChange={onInputGainChange}
              onPanChange={onInputPanChange}
              onMuteToggle={onInputMuteToggle}
              onSoloToggle={onInputSoloToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
