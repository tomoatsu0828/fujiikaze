import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9245;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureMobile() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_profile_mobile_snap',
    '--window-size=390,844',
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

  const { targetId } = await callBrowser('Target.createTarget', {
    url: 'http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88'
  });
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

  // トラック行が表示されるまでポーリング
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    const evalRes = await callSession('Runtime.evaluate', {
      expression: 'document.querySelectorAll(".daw-track-row").length > 0',
      returnByValue: true
    });
    if (evalRes?.result?.value === true) break;
  }

  await sleep(1500);

  const screenshot = await callSession('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/v5_mobile.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved /tmp/v5_mobile.png');

  chrome.kill();
}

captureMobile().catch(console.error);
