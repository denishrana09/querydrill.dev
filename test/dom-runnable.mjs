// Drives the runnable-example island against a real built lesson page.
//
// Deliberately against `dist/` and not a hand-written fixture. The island reads
// the code out of the block with `textContent`, which only works because Shiki
// keeps the source verbatim in its spans - so a fixture I wrote myself would
// prove nothing about the markup the site actually ships. It also means this
// test notices if Shiki ever starts adding line numbers or a copy button.
//
//   npm run build && node test/dom-runnable.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const OFF = '\x1b[0m';

const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ${GREEN}ok${OFF}    ${label}`);
  else {
    failures.push(`${label}${detail ? ' — ' + detail : ''}`);
    console.log(`  ${RED}FAIL${OFF}  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
};

// Three blocks, all reads, and the first one is `db.users.find()` - so a broken
// result is unambiguous rather than "maybe the filter matches nothing".
const PAGE = fileURLToPath(new URL('../dist/learn/find-and-findone/index.html', import.meta.url));
if (!existsSync(PAGE)) {
  console.log(`  ${RED}FAIL${OFF}  dist/ is missing - run \`npm run build\` first`);
  process.exit(1);
}

const dom = new JSDOM(readFileSync(PAGE, 'utf8'), { url: 'https://example.com/learn/find-and-findone/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const before = document.querySelectorAll('pre[data-runnable]').length;
check('the built page has runnable blocks to enhance', before === 3, `found ${before}`);

let loadError = null;
try {
  await import('../src/scripts/runnable.js');
} catch (err) {
  loadError = err;
}
check('the island module loads against the built markup', !loadError, loadError?.message);
if (loadError) { console.log(''); process.exit(1); }

const boxes = [...document.querySelectorAll('.rx')];
check('every block gets a toolbar', boxes.length === 3, `${boxes.length} enhanced`);
check('nothing is shown until something is run',
  boxes.every((b) => b.querySelector('.rx-out').hidden));
check('the code block survives being moved into the toolbar wrapper',
  boxes[0].querySelector('pre[data-runnable]')?.textContent === 'db.users.find()',
  JSON.stringify(boxes[0].querySelector('pre[data-runnable]')?.textContent));

const first = boxes[0];
const btn = (box, text) => [...box.querySelectorAll('button')].find((b) => b.textContent === text);

/** Wait for the lazy engine import and the query to settle. */
const settle = async () => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (!btn(first, 'Run')?.disabled) return;
  }
};

/* ---------- running ---------- */

btn(first, 'Run').click();
await settle();

const meta = first.querySelector('.rx-meta');
const body = first.querySelector('.rx-body');
check('the lazily imported engine resolves and runs', /\bok\b/.test(meta.textContent), meta.textContent);
check('the result reports the real row count', /\b30 documents\b/.test(meta.textContent), meta.textContent);
check('only the capped number of documents is rendered',
  /showing 20/.test(meta.textContent), meta.textContent);
check('the result is rendered through the shared formatter',
  body.querySelector('.k') !== null && body.textContent.includes('Denish'));

/* ---------- editing ---------- */

btn(first, 'Edit').click();
const editor = first.querySelector('.rx-editor');
check('Edit swaps the highlighted block for a textarea',
  editor && !editor.hidden && first.querySelector('pre[data-runnable]').hidden);
check('the textarea starts from the original query', editor.value === 'db.users.find()', editor.value);

editor.value = 'db.products.find({ category: "Audio" })';
btn(first, 'Run').click();
await settle();
check('running uses the edited query, not the original',
  /\b2 documents\b/.test(meta.textContent), meta.textContent);

btn(first, 'Reset').click();
check('Reset puts the original block back',
  !first.querySelector('pre[data-runnable]').hidden && first.querySelector('.rx-editor').hidden);
check('Reset also clears the stale result', first.querySelector('.rx-out').hidden);

btn(first, 'Run').click();
await settle();
check('the original query runs again after a reset',
  /\b30 documents\b/.test(meta.textContent), meta.textContent);

/* ---------- errors ---------- */

btn(first, 'Edit').click();
first.querySelector('.rx-editor').value = 'db.users.find({ $bogus: 1 })';
btn(first, 'Run').click();
await settle();
check('a broken query reports an error instead of throwing',
  /\berror\b/.test(meta.textContent) && body.textContent.length > 0,
  `${meta.textContent} / ${body.textContent.slice(0, 60)}`);

/* ---------- writes ---------- */

// The db is shared across the page on purpose, so a write in one block has to be
// visible - and admitted to - in another.
const second = boxes[1];
btn(second, 'Edit').click();
second.querySelector('.rx-editor').value = 'db.users.updateMany({}, { $set: { seen: true } })';
btn(second, 'Run').click();
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 10));
  if (!btn(second, 'Run')?.disabled) break;
}
const secondMeta = second.querySelector('.rx-meta');
check('a write is reported as having changed the page data',
  /data changed on this page/.test(secondMeta.textContent), secondMeta.textContent);
check('and offers to put it back', btn(second, 'restore it') !== undefined);

console.log(
  failures.length
    ? `\n  ${RED}${failures.length} runnable-island check(s) failed${OFF}\n`
    : `\n  ${GREEN}runnable island OK${OFF}\n`
);
process.exit(failures.length ? 1 : 0);
