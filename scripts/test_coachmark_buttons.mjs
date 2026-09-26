import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let nextPort = 9300;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureScreen(options) {
  const { url, width, height, outPath, actionFn } = options;
  const port = nextPort++;
  console.log(`Capturing ${url} (${width}x${height}) -> ${outPath}`);
  
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome_prof_${port}_${Date.now()}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
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

  // トラック行が表示され、ロードモーダルが消えるまで待機（最大30秒）
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const evalRes = await callSession('Runtime.evaluate', {
      expression: 'document.querySelectorAll(".daw-track-row").length > 0 && !document.querySelector(".daw-loading-modal")',
      returnByValue: true
    });
    if (evalRes?.result?.value === true) {
      console.log('Tracks ready!');
      break;
    }
  }

  await sleep(1500); // 描画安定

  if (actionFn) {
    await actionFn(callSession);
    await sleep(800);
  }

  const screenshot = await callSession('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved: ${outPath}`);

  chrome.kill();
}

async function run() {
  // 1. デスクトップ：初回訪問（コーチマーク吹き出しがルーラー／トラックの最前面に出ているか）
  await captureScreen({
    url: 'http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88',
    width: 1280,
    height: 850,
    outPath: '/tmp/01_coachmark_desktop.png'
  });

  // 2. モバイル：初回訪問（モバイル幅で吹き出しが隠れたりクリップされていないか）
  await captureScreen({
    url: 'http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88',
    width: 390,
    height: 844,
    outPath: '/tmp/02_coachmark_mobile.png'
  });

  // 3. Mute / Solo ボタンの視認性（点灯時＆消灯時のコントラスト）
  await captureScreen({
    url: 'http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88',
    width: 1280,
    height: 850,
    outPath: '/tmp/03_mute_solo_highlight.png',
    actionFn: async (callSession) => {
      // 吹き出しを閉じるボタンをクリック
      await callSession('Runtime.evaluate', {
        expression: `(() => {
          const okBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
          if (okBtn) okBtn.click();
          
          // トラック1のMuteをクリック、トラック2のSoloをクリック
          const allButtons = Array.from(document.querySelectorAll('button'));
          const mBtns = allButtons.filter(b => b.textContent.trim() === 'M');
          const sBtns = allButtons.filter(b => b.textContent.trim() === 'S');
          if (mBtns[0]) mBtns[0].click();
          if (sBtns[1]) sBtns[1].click();
        })()`
      });
    }
  });
}

run().catch(console.error);
