import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9225;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Launching Chrome with remote debugging on port ' + PORT);
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_direct_profile',
    '--window-size=1280,850',
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

  if (!wsUrl) {
    console.error('Could not get browser WebSocket debugger URL!');
    chrome.kill();
    return;
  }

  console.log('Browser WS URL:', wsUrl);
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

  const callPage = (method, params = {}) => {
    return callBrowser('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id: id++, method, params })
    });
  };

  // Wait for loading overlay to disappear
  console.log('Navigated to page, polling for tracks loading to complete...');
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const evalReqId = id++;
    const evalPromise = new Promise((resolve) => {
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === evalReqId) {
          browserWs.removeEventListener('message', handler);
          resolve(data.result?.result?.value);
        }
      };
      browserWs.addEventListener('message', handler);
    });

    browserWs.send(JSON.stringify({
      id: evalReqId,
      sessionId,
      method: 'Runtime.evaluate',
      params: { expression: '!document.querySelector(".daw-loading-overlay") && document.querySelectorAll(".daw-track-row").length > 0' }
    }));

    const isLoaded = await evalPromise;
    if (isLoaded) {
      console.log('Tracks successfully loaded! Waiting 500ms for final render...');
      await sleep(500);
      break;
    }
  }

  // Capture screenshot via Page.captureScreenshot
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
  writeFileSync('/tmp/06_tracks_final_success.png', Buffer.from(shotResult.data, 'base64'));
  console.log('Saved /tmp/06_tracks_final_success.png successfully!');

  browserWs.close();
  chrome.kill();
}

run().catch(console.error);
