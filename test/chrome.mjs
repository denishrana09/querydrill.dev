// A real browser over CDP, for the two tests that need layout.
//
// Split out of test/mobile.mjs when test/editor.mjs needed the same thing.
// Nothing here is a testing framework: it starts Astro's own preview server,
// finds a Chrome or an Edge already on the machine, opens a debugging socket and
// hands back `send`. Node has had a WebSocket client since 22, so this adds no
// dependency - and if no browser is found the caller is told to skip rather than
// being allowed to report a pass it never earned.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { preview } from 'astro';

export const GREEN = '\x1b[32m';
export const RED = '\x1b[31m';
export const DIM = '\x1b[2m';
export const OFF = '\x1b[0m';

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export const findBrowser = () => CANDIDATES.find((p) => existsSync(p));

/** Poll a URL until it answers, so neither server is raced. */
async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
}

/**
 * @param {{ previewPort: number, cdpPort: number, profile: string,
 *           width?: number, height?: number, mobile?: boolean }} opts
 * @returns {Promise<{ send: Function, base: string, evaluate: Function }>}
 */
export async function openChrome(opts) {
  const chrome = findBrowser();
  if (!chrome) throw new Error('no browser');

  const children = [];
  const cleanup = () => children.forEach((c) => { try { c.kill(); } catch { /* gone */ } });
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  const server = await preview({ server: { port: opts.previewPort }, logLevel: 'silent' });

  children.push(spawn(chrome, [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${opts.cdpPort}`,
    // Its own profile, so this never touches the one a real browser is using.
    `--user-data-dir=${process.env.TEMP || '/tmp'}/${opts.profile}`,
    'about:blank',
  ], { stdio: 'ignore' }));

  if (!(await waitFor(`http://127.0.0.1:${opts.cdpPort}/json/version`))) {
    throw new Error('Chrome did not open a debugging port');
  }

  const targets = await (await fetch(`http://127.0.0.1:${opts.cdpPort}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });

  let messageId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++messageId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  if (opts.width) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: opts.width,
      height: opts.height ?? 780,
      deviceScaleFactor: 1,
      mobile: Boolean(opts.mobile),
    });
  }
  await send('Page.enable');

  /**
   * Runs an expression in the page and gives back its value. Every probe in
   * these tests returns JSON.stringify(...) so that what crosses the wire is
   * plain data and a thrown error surfaces as a thrown error here, rather than
   * as an `undefined` that reads like a failing assertion.
   */
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) {
      throw new Error(res.result.exceptionDetails.exception?.description ?? 'page threw');
    }
    const value = res.result?.result?.value;
    return typeof value === 'string' ? JSON.parse(value) : value;
  };

  return { send, evaluate, base: `http://localhost:${opts.previewPort}`, server };
}

/** Polls a page expression until it is true, so nothing is timed by guesswork. */
export async function until(evaluate, expression, { tries = 80, gap = 50 } = {}) {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`JSON.stringify(Boolean(${expression}))`)) return true;
    await new Promise((r) => setTimeout(r, gap));
  }
  return false;
}
