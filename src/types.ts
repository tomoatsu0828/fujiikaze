export interface StemInfo {
  name: string;
  file?: string;
  src?: string;
  role?: string;
}

export interface SongInfo {
  dir: string;
  title: string;
  bpm?: number;
  beatOffset?: number; // ダウンビート（第1拍）の開始時間 (秒)
  beatTimes?: number[]; // LibROSA 抽出の全拍タイムスタンプ配列 (ミリ秒精度)
  stems: StemInfo[];
}

export interface Manifest {
  generatedAt: string;
  songs: SongInfo[];
}

export interface Peak {
  min: number;
  max: number;
}

export interface StemTrack {
  id: string;
  name: string;
  role: string;
  color: string;
  gain: number; // 0..2
  pan: number; // -1..1
  muted: boolean;
  solo: boolean;
  peaks: Peak[];
}

export type Song = SongInfo;
export type StemFile = StemInfo;
