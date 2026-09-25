import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9239;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(url, width, height, outPath, scrollX = 0) {
  console.log(`Capturing ${url} (${width}x${height}, scrollX: ${scrollX}) -> ${outPath}`);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/chrome_profile_${PORT}_${Date.now()}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const v = await res.json();
        wsUrl = v.webSocketDebuggerUrl;
        if (wsUrl) break;
      }
    } catch {}
  }

  if (!wsUrl) {
    chrome.kill();
    throw new Error('Chrome WS not found');
  }

  const browserWs = new WebSocket(wsUrl);
  await new Promise((r) => (browserWs.onopen = r));

  let id = 1;
  const callBrowser = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === reqId) {
          browserWs.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      browserWs.addEventListener('message', handler);
      browserWs.send(JSON.stringify({ id: reqId, method, params }));
    });
  };

  const { targetId } = await callBrowser('Target.createTarget', { url });
  const { sessionId } = await callBrowser('Target.attachToTarget', { targetId, flatten: true });

  const callSession = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const reqId = id++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === reqId) {
          browserWs.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      browserWs.addEventListener('message', handler);
      browserWs.send(JSON.stringify({ id: reqId, sessionId, method, params }));
    });
  };

  // トラック行が表示されるまでポーリング（最大15秒）
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const evalRes = await callSession('Runtime.evaluate', {
      expression: 'document.querySelectorAll(".daw-track-row").length > 0',
      returnByValue: true
    });
    if (evalRes?.result?.value === true) {
      break;
    }
  }

  await sleep(1500); // 描画安定待ち

  // もしスクロール指定があれば実行
  if (scrollX > 0) {
    await callSession('Runtime.evaluate', {
      expression: `(() => {
        const scrollArea = document.querySelector('.daw-timeline-scroll-area');
        if (scrollArea) {
          scrollArea.scrollLeft = ${scrollX};
        }
      })()`,
      returnByValue: true
    });
    await sleep(500);
  }

  const screenshot = await callSession('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${outPath}`);

  chrome.kill();
}

async function main() {
  // 1. デスクトップ
  await capture('http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88', 1280, 850, '/tmp/v5_desktop.png', 0);
  // 2. デスクトップ横スクロール時 (波形が途中で切れないかの検証)
  await capture('http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88', 1280, 850, '/tmp/v5_desktop_scrolled.png', 400);
  // 3. モバイル (iPhone 14相当)
  await capture('http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88', 390, 844, '/tmp/v5_mobile.png', 0);
  console.log('All v5 screenshots captured successfully!');
}

main().catch(console.error);
