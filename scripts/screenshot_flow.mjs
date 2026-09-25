import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  console.log('Starting Chrome headless with remote debugging...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_flow_profile',
    '--window-size=1280,850',
    'http://localhost:4173/'
  ]);

  await sleep(2500);

  let tabs = [];
  for (let i = 0; i < 20; i++) {
    try {
      await sleep(1000);
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      tabs = await res.json();
      if (tabs.length > 0) break;
    } catch {
      // retry
    }
  }
  const pageTab = tabs.find((t) => t.type === 'page');
  if (!pageTab || !pageTab.webSocketDebuggerUrl) {
    console.error('No page tab found!', tabs);
    chrome.kill();
    return;
  }

  console.log('Connecting to WebSocket:', pageTab.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  const takeScreenshot = async (filepath) => {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(filepath, Buffer.from(result.data, 'base64'));
    console.log(`Saved screenshot: ${filepath}`);
  };

  // 1. 初期画面 (ヒント吹き出し＋空状態)
  await sleep(1000);
  await takeScreenshot('/tmp/01_initial_screen.png');

  // 2. プロジェクト選択モーダルを開く
  console.log('Opening project modal...');
  await send('Runtime.evaluate', {
    expression: `
      const btn = document.querySelector('.cosmic-launch-btn') || document.querySelector('button');
      if (btn) btn.click();
    `
  });
  await sleep(1000);
  await takeScreenshot('/tmp/02_project_modal.png');

  // 3. 最初の曲 (燃えよ) をクリックしてロード
  console.log('Selecting first project...');
  await send('Runtime.evaluate', {
    expression: `
      const cards = document.querySelectorAll('.project-card, [data-slot="base"], div[role="button"]');
      for (const c of cards) {
        if (c.textContent.includes('燃えよ') || c.textContent.includes('01')) {
          c.click();
          break;
        }
      }
    `
  });

  // 音源ロード完了まで数秒待機
  console.log('Waiting for tracks to decode and load...');
  await sleep(6000);
  await takeScreenshot('/tmp/03_loaded_tracks.png');

  // 4. スマホ解像度にリサイズ
  console.log('Resizing to mobile (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(1000);
  await takeScreenshot('/tmp/04_mobile_screen.png');

  ws.close();
  chrome.kill();
  console.log('Done capturing all screenshots!');
}

capture().catch(console.error);
