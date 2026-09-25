import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'public/stems';
const audioExt = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac']);
const NUM = /^\s*\d+\s*[．.、\-＿_]*\s*/;

// ユーザー実機検証・確定済みの真のダウンビートオフセット & スタジオBPM
const SONG_METRICS = {
  '燃えよ': { bpm: 138.0, beatOffset: 0.693 },
  'damn': { bpm: 130.0, beatOffset: 1.220 },
  '旅路': { bpm: 176.0, beatOffset: 2.505 },
  '満ちてゆく': { bpm: 72.0, beatOffset: 2.620 },
  'Hachikō': { bpm: 110.0, beatOffset: 0.990 },
  'Hachiko': { bpm: 110.0, beatOffset: 0.990 },
};

const clean = (dir, file) => {
  let n = file.replace(/\.[^.]+$/, '');
  const dirNorm = dir.normalize('NFKC');
  const nNorm = n.normalize('NFKC');
  if (nNorm.startsWith(dirNorm)) {
    n = n.slice(dirNorm.length);
  }
  n = n.replace(NUM, '')
    .replace(/^[\s_\-．.、]+/, '')
    .replace(/[-_ ]*mixed$/i, '')
    .replace(/^[\s_\-]+/, '')
    .trim();
  if (n.length > 0) {
    n = n.charAt(0).toUpperCase() + n.slice(1);
  }
  return n || 'Track';
};

const roleOf = (n) =>
  /vocal|vo\b/i.test(n) ? 'vocal'
  : /drum/i.test(n) ? 'drums'
  : /bass/i.test(n) ? 'bass'
  : /guitar/i.test(n) ? 'guitar'
  : /piano|key/i.test(n) ? 'piano'
  : 'other';

const songs = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  .map((d) => {
    const title = d.name.replace(NUM, '').trim() || d.name;
    const metric = SONG_METRICS[title] || SONG_METRICS[title.normalize('NFC')] || { bpm: 120.0, beatOffset: 0.0 };

    return {
      dir: d.name,
      title,
      bpm: metric.bpm,
      beatOffset: metric.beatOffset,
      stems: readdirSync(join(root, d.name))
        .filter((f) => audioExt.has((f.split('.').pop() ?? '').toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'ja'))
        .map((f) => {
          const name = clean(d.name, f);
          const relPath = `stems/${d.name}/${f}`;
          return {
            name,
            role: roleOf(name),
            file: relPath,
            src: `/${relPath}`
          };
        })
    };
  })
  .filter((s) => s.stems.length > 0);

writeFileSync('public/stems.json', JSON.stringify({ generatedAt: new Date().toISOString(), songs }, null, 2));
console.log(`stems.json を生成しました: ${songs.length} 曲 (Exact Studio BPMs & Strict 4/4 Grids)`);
