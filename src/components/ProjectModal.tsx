import React from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import type { SongInfo } from '../engine';
import { IconProject, IconClose, IconPlay } from './Icons';

interface ProjectModalProps {
  isOpen: boolean;
  songs: SongInfo[];
  currentSong: SongInfo | null;
  isInitialLaunch?: boolean;
  onSelectSong: (song: SongInfo) => void;
  onClose: () => void;
}

export default function ProjectModal({
  isOpen,
  songs,
  currentSong,
  isInitialLaunch = false,
  onSelectSong,
  onClose,
}: ProjectModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`daw-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 ${
        isInitialLaunch ? 'initial-launch' : ''
      }`}
      onClick={isInitialLaunch ? undefined : onClose}
    >
      <div
        className="daw-project-modal relative w-full max-w-3xl max-h-[85vh] bg-[#070b18]/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,242,254,0.15)] flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 銀河の星屑＆オーロラ発光レイヤー */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

        {/* モーダルヘッダー */}
        <div className="project-modal-header flex items-center justify-between p-5 border-b border-white/[0.08] relative z-10 bg-white/[0.01]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-slate-800 to-violet-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <IconProject size={24} />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
                COSMIC AUDIO ENGINE
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                PROJECT LAUNCHER
              </h2>
              <p className="text-xs text-slate-400 font-normal mt-0.5">
                {isInitialLaunch
                  ? '制作を始める楽曲プロジェクトを選択してください'
                  : '切り替えたい楽曲プロジェクトを選択してください'}
              </p>
            </div>
          </div>

          {!isInitialLaunch && (
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              className="w-8 h-8 rounded-full bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.12]"
              onClick={onClose}
              title="閉じる"
            >
              <IconClose size={16} />
            </Button>
          )}
        </div>

        {/* 楽曲プロジェクトカード一覧 */}
        <div className="project-cards-grid p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3.5 relative z-10">
          {songs.map((song, idx) => {
            const isCurrent = currentSong?.dir === song.dir;
            const bpmFormatted = song.bpm
              ? song.bpm.toFixed(song.bpm % 1 === 0 ? 0 : 1)
              : '120';
            const offsetMs = ((song.beatOffset ?? 0) * 1000).toFixed(0);

            return (
              <div
                key={song.dir}
                onClick={() => {
                  onSelectSong(song);
                  onClose();
                }}
                className={`group relative rounded-xl p-4 cursor-pointer transition-all duration-300 border flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(0,242,254,0.25)] ring-1 ring-cyan-400/50'
                    : 'bg-white/[0.03] border-white/[0.08] hover:border-cyan-400/50 hover:bg-white/[0.06] hover:shadow-[0_0_15px_rgba(0,242,254,0.15)]'
                }`}
              >
                {/* オーロラボーダーグロー */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* 上部: 番号 & 曲名 & ACTIVEバッジ */}
                <div className="flex items-start justify-between gap-2 relative z-10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06]">
                      0{idx + 1}
                    </span>
                    <div className="truncate">
                      <h3 className="font-bold text-base text-white tracking-wide truncate group-hover:text-cyan-300 transition-colors">
                        {song.title}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400 block truncate">
                        {song.dir}
                      </span>
                    </div>
                  </div>

                  {isCurrent && (
                    <Chip
                      size="sm"
                      color="primary"
                      variant="solid"
                      className="font-mono text-[10px] tracking-wider uppercase h-5 font-bold shadow-[0_0_10px_rgba(0,242,254,0.5)]"
                    >
                      ACTIVE
                    </Chip>
                  )}
                </div>

                {/* メタ情報 (BPM, トラック数, ビート同期) */}
                <div className="grid grid-cols-3 gap-2 bg-black/40 rounded-lg p-2 border border-white/[0.05] text-center font-mono relative z-10">
                  <div>
                    <div className="text-[9px] text-slate-500">TEMPO</div>
                    <div className="text-xs font-bold text-amber-400">
                      {bpmFormatted} <span className="text-[9px] font-normal">BPM</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">TRACKS</div>
                    <div className="text-xs font-semibold text-slate-200">
                      {song.stems.length} <span className="text-[9px]">Stems</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500">LIBROSA SYNC</div>
                    <div className="text-xs font-semibold text-violet-300">
                      {offsetMs} <span className="text-[9px]">ms</span>
                    </div>
                  </div>
                </div>

                {/* ステムトラックタグプレビュー */}
                <div className="flex flex-wrap gap-1 relative z-10">
                  {song.stems.map((stem, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/[0.06]"
                    >
                      {stem.name}
                    </span>
                  ))}
                </div>

                {/* 開くアクションボタン (HeroUI Button) */}
                <Button
                  size="sm"
                  className={`w-full font-bold text-xs tracking-wider uppercase transition-all relative z-10 ${
                    isCurrent
                      ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(0,242,254,0.6)]'
                      : 'bg-white/[0.08] text-slate-200 group-hover:bg-cyan-500 group-hover:text-black group-hover:shadow-[0_0_12px_rgba(0,242,254,0.5)]'
                  }`}
                >
                  <IconPlay size={13} />
                  <span>{isCurrent ? '読み込み中・選択中' : 'このプロジェクトを開く'}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
