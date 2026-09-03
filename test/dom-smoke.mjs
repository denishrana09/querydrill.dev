// Loads the real app module against the real page markup in jsdom and drives
// the main interactions. Catches the failure the other tests structurally
// cannot: correct logic wired to an element id that does not exist, which looks
// fine in every unit test and is a blank page in a browser.
//
//   node test/dom-smoke.mjs

import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { JSDOM } from 'jsdom';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const OFF = '\x1b[0m';

const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ${GREEN}ok${OFF}    ${label}`);
  else { failures.push(`${label}${detail ? ' — ' + detail : ''}`); console.log(`  ${RED}FAIL${OFF}  ${label}`); }
};

// Pull the markup straight out of the page component, so this test breaks if
// the template and the script drift apart.
const page = await readFile(new URL('../src/pages/practice/index.astro', import.meta.url), 'utf8');
const body = page.slice(page.indexOf('<header'), page.indexOf('<script>'));

const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
  url: 'https://example.com/practice/',
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.confirm = () => true;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// Surface anything the module throws while wiring itself up.
let loadError = null;
try {
  await import('../src/scripts/app.js');
} catch (err) {
  loadError = err;
}
check('app module loads against the page markup', !loadError, loadError?.message);
if (loadError) { console.log(''); process.exit(1); }

const $ = (id) => document.getElementById(id);
const tick = () => new Promise((r) => setTimeout(r, 0));

check('collections render', $('collections').children.length === 3,
  `got ${$('collections').children.length}`);
check('exercise list renders', $('exerciseList').querySelectorAll('.ex').length === 38,
  `got ${$('exerciseList').querySelectorAll('.ex').length}`);
check('progress shows a total', /\/38 passed/.test($('progress').textContent),
  $('progress').textContent);

// Clicking a collection should load a starter query and a sample document.
$('collections').children[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('clicking a collection fills the editor', $('editor').value.startsWith('db.'), $('editor').value);

// Sidebar shows an inferred field list, not one raw document.
const rows = [...$('schema').querySelectorAll('.row')];
const named = (n) => rows.find((r) => r.querySelector('.nm').textContent === n);
check('schema lists top-level fields', Boolean(named('status') && named('items')),
  rows.map((r) => r.querySelector('.nm').textContent).join(','));
check('schema descends into array elements',
  rows.some((r) => r.classList.contains('d1') && r.querySelector('.nm').textContent === 'price'));
check('schema flags optional fields with a percentage',
  Boolean(named('discount')?.querySelector('.opt')),
  named('discount')?.querySelector('.ty')?.textContent);

// Clicking a field inserts its dotted path — the point of the whole panel.
$('editor').value = '';
$('editor').selectionStart = $('editor').selectionEnd = 0;
named('price').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('clicking a field inserts its dotted path', $('editor').value === 'items.price',
  $('editor').value);

// Raw document is still reachable behind the toggle.
$('rawToggle').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('raw doc toggle reveals a document',
  !$('sampleDoc').hidden && $('sampleDoc').innerHTML.includes('_id'));
$('rawToggle').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('raw doc toggle returns to the field list', !$('schema').hidden && $('sampleDoc').hidden);

// Run a query.
$('editor').value = 'db.users.find({ status: "active" }).limit(2)';
$('runBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 20; i++) await tick();
check('running a query produces results', $('resultMeta').textContent.includes('ok'),
  $('resultMeta').textContent);
check('results are rendered', $('resultBody').innerHTML.includes('status'));

// Open the first exercise and submit its own solution.
const firstCard = $('exerciseList').querySelector('.ex .ex-title');
firstCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const openCard = $('exerciseList').querySelector('.ex.open');
check('opening an exercise expands it', Boolean(openCard));
check('opening an exercise loads its starter code', $('editor').value.length > 0);

const { EXERCISES } = await import('../server/exercises/index.js');
$('editor').value = EXERCISES[0].solution;
openCard.querySelector('.ex-actions button.primary')
  .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 40; i++) await tick();

const feedback = openCard.querySelector('.ex-feedback');
check('checking a correct answer gives passing feedback',
  Boolean(feedback) && feedback.classList.contains('pass'), feedback?.textContent);
check('progress is written to localStorage',
  JSON.parse(localStorage.getItem('mp.progress') || '{}')[EXERCISES[0].id] === 'pass');

// The restore affordance stays hidden until a query has actually written
// something - a permanently visible one implies a problem that rarely exists.
check('restore is hidden while data is untouched', $('dirtyBar').hidden);

$('editor').value = 'db.users.find({ status: "active" })';
$('runBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 20; i++) await tick();
check('a read query does not offer to restore', $('dirtyBar').hidden);

$('editor').value = 'db.users.deleteMany({})';
$('runBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 20; i++) await tick();
const afterDelete = $('collections').textContent.match(/users(\d+)/)?.[1];
check('a write query offers to restore', !$('dirtyBar').hidden);

$('resetDataBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const afterReset = $('collections').textContent.match(/users(\d+)/)?.[1];
check('restore brings the dataset back', afterDelete === '0' && afterReset === '30',
  `after delete ${afterDelete}, after reset ${afterReset}`);
check('restore hides itself again', $('dirtyBar').hidden);

// The splitter must be usable without a mouse.
const pane = document.querySelector('.editor-pane');
const before = pane.style.getPropertyValue('--editor-h');
$('splitter').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
check('splitter responds to the keyboard',
  pane.style.getPropertyValue('--editor-h') !== before,
  `${before || '(unset)'} -> ${pane.style.getPropertyValue('--editor-h')}`);

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} failure(s):${OFF}`);
  for (const f of failures) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ${GREEN}DOM smoke OK${OFF}\n`);
