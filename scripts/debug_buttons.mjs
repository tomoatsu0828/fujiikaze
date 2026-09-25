import { spawn } from 'node:child_process';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9231;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_inspect_offsets',
    '--window-size=1280,850',
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

  const evalRes = await callSession('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('.daw-transport-bar button'));
      return JSON.stringify(btns.filter(b => b.querySelector('svg')).map(b => {
        const bRect = b.getBoundingClientRect();
        const svg = b.querySelector('svg');
        const sRect = svg.getBoundingClientRect();
        const idealOffsetX = (bRect.width - sRect.width) / 2;
        const actualOffsetX = sRect.left - bRect.left;
        const diffX = actualOffsetX - idealOffsetX;
        
        const idealOffsetY = (bRect.height - sRect.height) / 2;
        const actualOffsetY = sRect.top - bRect.top;
        const diffY = actualOffsetY - idealOffsetY;

        return {
          title: b.getAttribute('title') || b.className,
          btnSize: \`\${bRect.width}x\${bRect.height}\`,
          svgSize: \`\${sRect.width}x\${sRect.height}\`,
          actualOffsetX: actualOffsetX.toFixed(2),
          idealOffsetX: idealOffsetX.toFixed(2),
          diffX: diffX.toFixed(2),
          actualOffsetY: actualOffsetY.toFixed(2),
          idealOffsetY: idealOffsetY.toFixed(2),
          diffY: diffY.toFixed(2),
        };
      }), null, 2);
    })()`,
    returnByValue: true
  });

  console.log(evalRes.result.value);

  chrome.kill();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
