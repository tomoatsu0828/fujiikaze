import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9232;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_mobile_test',
    '--window-size=390,844',
    'about:blank'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(300);
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

  const { sessionId } = await callBrowser('Target.attachToTarget', {
    targetId,
    flatten: true
  });

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

  await sleep(3000);

  // スクリーンショット撮影
  const screenshot = await callSession('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/mobile_dock_screenshot.png', Buffer.from(screenshot.data, 'base64'));

  // モバイルドックのボタンオフセット検査
  const evalRes = await callSession('Runtime.evaluate', {
    expression: `(() => {
      const dock = document.querySelector('.daw-mobile-dock');
      if (!dock) return 'dock not found';
      const btns = Array.from(dock.querySelectorAll('button'));
      return JSON.stringify(btns.map(b => {
        const bRect = b.getBoundingClientRect();
        const svg = b.querySelector('svg');
        let diffX = 0, diffY = 0, sRect = { width: 0, height: 0 };
        if (svg) {
          sRect = svg.getBoundingClientRect();
          const idealOffsetX = (bRect.width - sRect.width) / 2;
          const actualOffsetX = sRect.left - bRect.left;
          diffX = actualOffsetX - idealOffsetX;
          const idealOffsetY = (bRect.height - sRect.height) / 2;
          const actualOffsetY = sRect.top - bRect.top;
          diffY = actualOffsetY - idealOffsetY;
        }
        return {
          title: b.getAttribute('title') || b.className,
          btnSize: \`\${bRect.width.toFixed(1)}x\${bRect.height.toFixed(1)}\`,
          svgSize: \`\${sRect.width}x\${sRect.height}\`,
          diffX: diffX.toFixed(2),
          diffY: diffY.toFixed(2)
        };
      }), null, 2);
    })()`,
    returnByValue: true
  });

  console.log('Mobile dock buttons inspection:', evalRes.result.value);

  chrome.kill();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
