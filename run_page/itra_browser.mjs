/**
 * Read the pages of the itra runner space with a browser.
 *
 * The site answers a request that does not come from a browser with a
 * javascript challenge, only a browser can solve it, so chrome runs with a
 * screen and the pages are read through the devtools protocol.
 *
 * usage: node itra_browser.mjs <folder> <name> <url> <marker> [...]
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'microsoft-edge',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];

const PAGE_TIMEOUT = 90000;
const BLOCKED = 'Something Went Wrong';

const findBrowser = () => {
  for (const candidate of BROWSER_CANDIDATES) {
    if (!candidate) continue;
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const which = process.platform === 'win32' ? 'where' : 'which';
    const found = spawnSync(which, [candidate], { encoding: 'utf8' });
    const path = (found.stdout || '').split('\n')[0].trim();
    if (found.status === 0 && path) return path;
  }
  return null;
};

const findX = (name) => {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const found = spawnSync(which, [name], { encoding: 'utf8' });
  return found.status === 0 ? (found.stdout || '').split('\n')[0].trim() : '';
};

class Devtools {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.next = 0;
    this.waiting = new Map();
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve);
      this.socket.addEventListener('error', () =>
        reject(new Error('the devtools socket did not open'))
      );
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.waiting.get(message.id);
      if (!entry) return;
      this.waiting.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.next;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) =>
      this.waiting.set(id, { resolve, reject })
    );
  }
}

const readPort = async (profile, gone) => {
  const file = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      if (lines[0] && lines[0].trim()) return lines[0].trim();
    }
    if (gone()) throw new Error(gone());
    await sleep(500);
  }
  throw new Error('the browser did not open its devtools port');
};

const main = async () => {
  const [folder, ...rest] = process.argv.slice(2);
  if (!folder || rest.length < 3 || rest.length % 3 !== 0) {
    throw new Error(
      'usage: itra_browser.mjs <folder> <name> <url> <marker> [...]'
    );
  }
  const pages = [];
  for (let index = 0; index < rest.length; index += 3) {
    pages.push({
      name: rest[index],
      url: rest[index + 1],
      marker: rest[index + 2],
    });
  }

  const browser = findBrowser();
  if (!browser) throw new Error('no browser was found on this machine');

  mkdirSync(folder, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), 'itra-chrome-'));
  const args = [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--window-size=1400,1000',
    'about:blank',
  ];
  // the site refuses a headless browser, it needs a screen to draw on
  const screen = process.env.DISPLAY
    ? []
    : findX('xvfb-run')
      ? ['xvfb-run', '-a']
      : [];
  const chrome = spawn(
    screen[0] || browser,
    [...screen.slice(1), browser, ...args],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let browserLog = '';
  chrome.stdout.on('data', (chunk) => {
    browserLog += chunk;
  });
  chrome.stderr.on('data', (chunk) => {
    browserLog += chunk;
  });
  let browserGone = null;
  chrome.on('exit', (code) => {
    browserGone = `the browser stopped with the code ${code}`;
  });

  let devtools = null;
  try {
    const port = await readPort(profile, () => browserGone);
    const version = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(15000),
    }).then((answer) => answer.json());
    devtools = new Devtools(version.webSocketDebuggerUrl);
    await devtools.open();
    const { targetId } = await devtools.send('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await devtools.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await devtools.send('Page.enable', {}, sessionId);

    const failures = [];
    for (const page of pages) {
      try {
        await devtools.send('Page.navigate', { url: page.url }, sessionId);
        const deadline = Date.now() + PAGE_TIMEOUT;
        let html = '';
        while (Date.now() < deadline) {
          await sleep(1000);
          try {
            const answer = await devtools.send(
              'Runtime.evaluate',
              {
                expression: 'document.documentElement.outerHTML',
                returnByValue: true,
              },
              sessionId
            );
            html = answer?.result?.value || '';
          } catch {
            continue;
          }
          if (html.includes(BLOCKED)) {
            throw new Error('itra refused the page');
          }
          if (html.includes(page.marker)) break;
        }
        if (!html.includes(page.marker)) {
          throw new Error(`the page never showed ${page.marker}`);
        }
        writeFileSync(join(folder, `${page.name}.html`), html, 'utf8');
        console.log(`the browser read ${page.url}`);
      } catch (error) {
        // one page that fails must not throw the others away
        failures.push(`${page.name}: ${error.message}`);
        console.error(
          `the browser could not read ${page.url}: ${error.message}`
        );
      }
    }
    if (failures.length) {
      throw new Error(failures.join('; '));
    }
  } catch (error) {
    // the words of the browser tell why it did not answer
    error.message = `${error.message}\n--- the browser said ---\n${browserLog.slice(-2000)}`;
    throw error;
  } finally {
    // the socket of the browser keeps the loop of node alive, it has to go
    if (devtools) devtools.socket.close();
    chrome.kill();
    await sleep(1000);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // the browser still holds a file of its profile, the folder is in the temp
    }
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
  });
