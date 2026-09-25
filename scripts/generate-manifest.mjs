import { readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = 'public/stems';
if (!existsSync(root)) {
  console.error('public/stems が見つかりません');
  process.exit(1);
}

const audioExt = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']);
const NUM = /^[0-9０-９]+[．.、]\s*/;

function cleanName(dir, file) {
  let n = basename(file).replace(/\.[^.]+$/, '');
  n = n.replace(NUM, '');
  const title = dir.replace(NUM, '');
  if (title) n = n.split(title).join('');
  n = n.replace(/[_\-]+/g, ' ').replace(/mixed/gi, '').trim();
  return n || basename(file).replace(/\.[^.]+$/, '');
}

const songs = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  .map((d) => {
    const files = readdirSync(join(root, d.name))
      .filter((f) => audioExt.has(f.slice(f.lastIndexOf('.')).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, 'ja'));
    return {
      id: d.name,
      title: d.name.replace(NUM, ''),
      dir: d.name,
      tracks: files.map((f) => ({ name: cleanName(d.name, f), file: f }))
    };
  })
  .filter((s) => s.tracks.length > 0);

writeFileSync('public/stems.json', JSON.stringify({ songs }, null, 2));
console.log(`stems.json generated: ${songs.length} songs`);
