import React, { useRef, useState, useCallback } from 'react';

interface PotKnobProps {
  value: number; // -1.0 (L) ~ +1.0 (R), 0 is Center
  onChange: (val: number) => void;
  size?: number;
  label?: string;
  color?: string;
  title?: string;
}

export default function PotKnob({
  value,
  onChange,
  size = 32,
  label = 'PAN',
  color = '#38bdf8',
  title = 'Pan (上下ドラッグで調整、ダブルクリックで中央)',
}: PotKnobProps) {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  // -1.0 ~ +1.0 を -135度 ~ +135度にマッピング
  const angle = Math.max(-135, Math.min(135, value * 135));

  // 値の文字列表示
  const displayText =
    Math.abs(value) < 0.02
      ? 'C'
      : value < 0
      ? `L${Math.round(Math.abs(value) * 100)}`
      : `R${Math.round(value * 100)}`;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dy = startYRef.current - e.clientY; // 上にドラッグでプラス、下にドラッグでマイナス
    const sensitivity = e.shiftKey ? 0.002 : 0.01;
    let nextVal = startValRef.current + dy * sensitivity;
    nextVal = Math.max(-1, Math.min(1, nextVal));

    // Center付近（-0.04 ~ +0.04）はセンターにスナップ
    if (Math.abs(nextVal) < 0.04) {
      nextVal = 0;
    }

    onChange(parseFloat(nextVal.toFixed(2)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(0); // センターリセット
  };

  // SVG アークの計算 (センター 0度から angle まで)
  const center = size / 2;
  const radius = size * 0.40;
  const strokeWidth = Math.max(2, size * 0.08);

  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    // 0度は真上 (cy - r)
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
    const sweepFlag = endAngle >= startAngle ? '1' : '0';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, sweepFlag, end.x, end.y].join(' ');
  };

  const backgroundArc = describeArc(center, center, radius, -135, 135);
  const activeArc =
    Math.abs(angle) > 1
      ? angle > 0
        ? describeArc(center, center, radius, 0, angle)
        : describeArc(center, center, radius, angle, 0)
      : null;

  return (
    <div
      className="pot-knob-wrapper flex flex-col items-center select-none cursor-ns-resize group"
      title={title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          {/* 背景レール */}
          <path
            d={backgroundArc}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* センター目印 */}
          <line
            x1={center}
            y1={center - radius - 1.5}
            x2={center}
            y2={center - radius + 1.5}
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {/* アクティブアーク (センターからの変化量) */}
          {activeArc && (
            <path
              d={activeArc}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 3px ${color})`,
              }}
            />
          )}

          {/* ノブ本体 (円形ダークメタルダイヤル) */}
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth - 1}
            fill="url(#potKnobGradient)"
            stroke={isHovered ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)'}
            strokeWidth={1}
            className="transition-colors"
          />

          {/* ポインターインジケーター (回転する針) */}
          <g transform={`rotate(${angle} ${center} ${center})`}>
            <line
              x1={center}
              y1={center}
              x2={center}
              y2={center - radius + strokeWidth + 2}
              stroke={Math.abs(value) < 0.02 ? '#ffffff' : color}
              strokeWidth={Math.max(2, size * 0.07)}
              strokeLinecap="round"
              style={{
                filter: Math.abs(value) >= 0.02 ? `drop-shadow(0 0 2px ${color})` : 'none',
              }}
            />
          </g>

          <defs>
            <linearGradient id="potKnobGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#242c42" />
              <stop offset="100%" stopColor="#0d111e" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ラベル & 値 */}
      <div className="flex items-center gap-0.5 mt-0.5">
        {label && <span className="text-[7px] font-mono text-slate-500 font-bold uppercase">{label}</span>}
        <span
          className={`text-[8px] font-mono font-semibold transition-colors ${
            Math.abs(value) < 0.02 ? 'text-slate-400' : 'text-sky-300'
          }`}
        >
          {displayText}
        </span>
      </div>
    </div>
  );
}
