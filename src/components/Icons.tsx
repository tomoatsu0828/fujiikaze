import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export function IconPlay({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M8.5 5.14v13.72a1 1 0 0 0 1.54.84l11-6.86a1 1 0 0 0 0-1.68l-11-6.86A1 1 0 0 0 8.5 5.14z" />
    </svg>
  );
}

export function IconPause({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function IconStop({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

export function IconRTZ({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <rect x="4.5" y="5" width="2.5" height="14" rx="1" />
      <path d="M19.5 6.27v11.46a1 1 0 0 1-1.55.83l-9.17-5.73a1 1 0 0 1 0-1.66l9.17-5.73A1 1 0 0 1 19.5 6.27z" />
    </svg>
  );
}

export function IconRewind({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M11 6.27v11.46a1 1 0 0 1-1.55.83l-7.17-4.48a1 1 0 0 1 0-1.66l7.17-4.48A1 1 0 0 1 11 6.27z" />
      <path d="M21 6.27v11.46a1 1 0 0 1-1.55.83l-7.17-4.48a1 1 0 0 1 0-1.66l7.17-4.48A1 1 0 0 1 21 6.27z" />
    </svg>
  );
}

export function IconFastForward({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path d="M3 17.73V6.27a1 1 0 0 1 1.55-.83l7.17 4.48a1 1 0 0 1 0 1.66l-7.17 4.48A1 1 0 0 1 3 17.73z" />
      <path d="M13 17.73V6.27a1 1 0 0 1 1.55-.83l7.17 4.48a1 1 0 0 1 0 1.66l-7.17 4.48A1 1 0 0 1 13 17.73z" />
    </svg>
  );
}

export function IconLoop({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/** 誰が見ても一目でわかるDAWメトロノーム (ピラミッド本体 + 振り子アーム + ウェイト) */
export function IconMetronome({ size = 18, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {/* メトロノーム外形ピラミッド */}
      <path d="M7 21h10l-3.5-17h-3L7 21z" />
      {/* 底面ベースライン */}
      <path d="M5.5 21h13" />
      {/* 振り子アーム (斜めに振れるロッド) */}
      <line x1="12" y1="18" x2="16.5" y2="7" strokeWidth="2" stroke="currentColor" />
      {/* 振り子ウェイト */}
      <rect x="14.5" y="8" width="4" height="3" rx="0.5" fill="currentColor" stroke="none" />
      {/* 振り子ピボット */}
      <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconProject({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function IconZoomIn({ size = 14, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function IconZoomOut({ size = 14, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export function IconZoomFit({ size = 14, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function IconMic({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

export function IconClose({ size = 16, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* 楽器ロールアイコン */
export function IconVocal({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function IconDrums({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <ellipse cx="12" cy="7" rx="8" ry="3.5" />
      <path d="M4 7v8c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V7" />
      <line x1="7" y1="8.5" x2="7" y2="17" />
      <line x1="17" y1="8.5" x2="17" y2="17" />
    </svg>
  );
}

export function IconBass({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="7" cy="17" r="4" />
      <path d="M11 17V3h6v4h-6" />
    </svg>
  );
}

export function IconGuitar({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M6 19a3 3 0 0 0 4.24 0L19 10.24a2 2 0 0 0 0-2.83l-2.41-2.41a2 2 0 0 0-2.83 0L4.93 13.83A3 3 0 0 0 6 19z" />
      <circle cx="11.5" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconPiano({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="4" x2="7" y2="20" />
      <line x1="11" y1="4" x2="11" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
      <rect x="5.5" y="4" width="3" height="9" fill="currentColor" />
      <rect x="13.5" y="4" width="3" height="9" fill="currentColor" />
    </svg>
  );
}

export function IconSynth({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15h10M7 9l3 3 4-4 3 3" />
    </svg>
  );
}

export function IconOther({ size = 15, className = '', ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m14 9-6 6M9 9h6v6" />
    </svg>
  );
}

