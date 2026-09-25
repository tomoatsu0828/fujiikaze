import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9226;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMobile() {
  console.log('Testing mobile view 390x844...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_mobile_profile',
    '--window-size=390,844',
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const v = await res.json();
        wsUrl = v.webSocketDebuggerUrl;
        if (wsUrl) break;
      }
    } catch {
      // wait
    }
  }

  const browserWs = new WebSocket(wsUrl);
  await new Promise((r) => browserWs.onopen = r);

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

  // Create new page target
  const { targetId } = await callBrowser('Target.createTarget', { url: 'http://localhost:4173/?song=%E7%87%83%E3%81%88%E3%82%88' });
  const { sessionId } = await callBrowser('Target.attachToTarget', { targetId, flatten: true });

  // Emulate mobile
  browserWs.send(JSON.stringify({
    id: id++,
    sessionId,
    method: 'Emulation.setDeviceMetricsOverride',
    params: {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    }
  }));

  console.log('Waiting 5s for mobile render...');
  await sleep(5000);

  const shotReqId = id++;
  const shotPromise = new Promise((resolve, reject) => {
    const handler = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === shotReqId) {
        browserWs.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    browserWs.addEventListener('message', handler);
  });

  browserWs.send(JSON.stringify({
    id: shotReqId,
    sessionId,
    method: 'Page.captureScreenshot',
    params: { format: 'png' }
  }));

  const shotResult = await shotPromise;
  writeFileSync('/tmp/07_mobile_screenshot.png', Buffer.from(shotResult.data, 'base64'));
  console.log('Saved /tmp/07_mobile_screenshot.png successfully!');

  browserWs.close();
  chrome.kill();
}

runMobile().catch(console.error);
