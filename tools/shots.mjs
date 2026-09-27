// Regenerates the three screenshots the README leads with.
//
//   npm run shots          # builds, then drives a real browser and writes docs/
//
// Re-run it after anything that changes what the app looks like - the theme
// tokens, the layout, the logo, the site name - because a stale screenshot is a
// promise the site no longer keeps. It is a script rather than a set of files
// pasted in by hand for exactly that reason: the shots have to be cheap to redo.
//
// Nothing here is mocked. The ticks in the first shot are earned by submitting
// those drills' real solutions through the Check button, and the second shot is
// a genuine near-miss being graded - the same mistake that drill's own note is
// about. If grading ever stops agreeing with those queries, this script fails
// instead of quietly producing a screenshot that lies.
//
// Needs a Chrome or Edge, like the browser test suites. `CHROME=/path/to/chrome`
// if yours is somewhere unusual.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { openChrome, until, findBrowser, GREEN, RED, OFF } from '../test/chrome.mjs';
import { EXERCISES } from '../server/exercises/index.js';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));
const WIDTH = 1440;
const HEIGHT = 880;

if (!findBrowser()) {
  console.log(`\n  ${RED}no Chrome or Edge found - set CHROME=/path/to/chrome${OFF}\n`);
  process.exit(1);
}

const { send, evaluate, base, server } = await openChrome({
  previewPort: 4332,
  cdpPort: 9332,
  profile: 'mp-readme',
  width: WIDTH,
  height: HEIGHT,
});

const fail = (why) => {
  console.log(`\n  ${RED}${why}${OFF}\n`);
  process.exitCode = 1;
  return server.stop().then(() => process.exit(1));
};

const CTRL = 2;
const press = async (key, code, vk, modifiers = 0) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, key, code, windowsVirtualKeyCode: vk });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, key, code, windowsVirtualKeyCode: vk });
};

/** Replace the editor's whole document. insertText, not per-character typing:
 *  auto-close would otherwise double every bracket. */
async function setEditor(text) {
  await evaluate(`JSON.stringify(Boolean(document.querySelector('.cm-content')?.focus() ?? true))`);
  await press('a', 'KeyA', 65, CTRL);
  await send('Input.insertText', { text });
}

const click = (sel) => evaluate(`JSON.stringify((() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return false;
  el.click();
  return true;
})())`);

const openDrill = (title) => evaluate(`JSON.stringify((() => {
  const card = [...document.querySelectorAll('.ex')]
    .find((c) => c.querySelector('.ex-name')?.textContent === ${JSON.stringify(title)});
  if (!card) return false;
  if (!card.classList.contains('open')) card.querySelector('.ex-title').click();
  return true;
})())`);

const written = [];
const shoot = async (name, clip) => {
  const shot = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
  const bytes = Buffer.from(shot.result.data, 'base64');
  writeFileSync(`${DOCS}${name}.png`, bytes);
  written.push(`${name}.png  ${Math.round(bytes.length / 1024)} KB`);
};

// Headless Chrome reports a light OS, and the site honours that. Dark is the
// stylesheet's own default and the better hero for a code tool, so emulate a
// visitor whose machine is set to dark rather than poking data-theme by hand.
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

await send('Page.navigate', { url: `${base}/practice/` });
await until(evaluate, "document.querySelector('.cm-content')");

/* ---------- earn some ticks, the way a learner would ---------- */

const SOLVE = [
  'Equality + projection', 'Range query', '$in',
  'Dot notation into a nested object', 'Array contains a value',
];
let solved = 0;
for (const ex of EXERCISES) {
  if (!SOLVE.includes(ex.title)) continue;
  if (!(await openDrill(ex.title))) continue;
  await setEditor(ex.solution);
  await click('.ex.open .ex-actions button.primary');
  if (await until(evaluate, "document.querySelector('.ex.open .ex-feedback.pass')")) solved++;
  await click('.ex.open .ex-title'); // close it again
}
if (solved !== SOLVE.length) {
  await fail(`only ${solved} of ${SOLVE.length} drills passed their own solution - the ticks would be a lie`);
}

/* ---------- shot 1: the app ---------- */

// Reload so the editor label goes back to "free play" instead of naming the last
// drill solved above, while the ticks - which live in localStorage - stay.
await send('Page.navigate', { url: `${base}/practice/` });
await until(evaluate, "document.querySelector('.cm-content')");
await click('#collections li:nth-child(1)'); // orders
await setEditor(`db.orders.aggregate([
  { $match: { status: "completed" } },
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.product",
      revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
      orders: { $sum: 1 }
    }
  },
  { $sort: { revenue: -1 } },
  { $limit: 6 }
])`);
await click('#runBtn');
if (!(await until(evaluate, "document.getElementById('resultMeta').textContent.includes('ok')"))) {
  await fail('the hero query did not run');
}
await evaluate(`JSON.stringify((document.activeElement?.blur(), true))`);
await shoot('screenshot-app');

/* ---------- shot 2: a near miss, graded ---------- */

await openDrill('$unwind + $group - revenue per product');
// The mistake the drill's own note is about: unit price, quantity forgotten.
await setEditor(`db.orders.aggregate([
  { $match: { status: "completed" } },
  { $unwind: "$items" },
  { $group: { _id: "$items.product", revenue: { $sum: "$items.price" } } },
  { $sort: { revenue: -1 } }
])`);
await click('.ex.open .ex-actions button.primary');
if (!(await until(evaluate, "document.querySelector('.ex.open .ex-mistakes')"))) {
  await fail('the near-miss did not produce graded feedback - has the drill or the grader changed?');
}

const clip = await evaluate(`JSON.stringify((() => {
  const card = document.querySelector('.ex.open');
  card.scrollIntoView({ block: 'center' });
  const r = card.getBoundingClientRect();
  return { x: Math.floor(r.x - 8), y: Math.ceil(r.y + 1),
           width: Math.ceil(r.width + 16), height: Math.floor(r.height - 2),
           diffs: [...card.querySelectorAll('.ex-feedback li')].map((n) => n.textContent) };
})())`);

await evaluate(`JSON.stringify((document.activeElement?.blur(), true))`);
await shoot('screenshot-feedback', { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 2 });

/* ---------- shot 3: a lesson, with its examples runnable in place ---------- */

// lookup-basics: its first example is five lines, so the heading, the toolbar,
// the query and its output all fit on one screen - which is the claim the shot
// is making.
await send('Page.navigate', { url: `${base}/learn/lookup-basics/` });
if (!(await until(evaluate, "document.querySelector('.rx-bar button')"))) {
  await fail('no runnable example found on the lesson page');
}
await evaluate(`JSON.stringify((document.querySelector('.rx-bar button').click(), true))`);
if (!(await until(evaluate, "document.querySelector('.rx-body')?.textContent.trim().length > 0"))) {
  await fail('the example never produced output');
}

const box = await evaluate(`JSON.stringify((() => {
  const rx = document.querySelector('.rx');
  rx.scrollIntoView({ block: 'center' });
  document.activeElement?.blur();
  const r = rx.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
})())`);
if (box.top < 0 || box.bottom > HEIGHT) {
  await fail(`the lesson example no longer fits on screen (${box.top} to ${box.bottom} of ${HEIGHT})`);
}
await shoot('screenshot-lesson');

console.log('\n  the feedback shot is showing:');
for (const d of clip.diffs) console.log(`    ${d}`);
console.log(`\n  wrote into docs/:`);
for (const w of written) console.log(`    ${w}`);
console.log(`\n  ${GREEN}screenshots regenerated${OFF} - check them, then commit them with whatever changed the UI\n`);

await server.stop();
process.exit(0);
