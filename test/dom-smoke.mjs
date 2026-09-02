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
check('clicking a collection shows a sample doc', $('sampleDoc').innerHTML.includes('_id'));

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

// Reset data must restore counts after a destructive query.
$('editor').value = 'db.users.deleteMany({})';
$('runBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 20; i++) await tick();
const afterDelete = $('collections').textContent.match(/users(\d+)/)?.[1];
$('resetDataBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const afterReset = $('collections').textContent.match(/users(\d+)/)?.[1];
check('reset data restores the dataset', afterDelete === '0' && afterReset === '30',
  `after delete ${afterDelete}, after reset ${afterReset}`);

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} failure(s):${OFF}`);
  for (const f of failures) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ${GREEN}DOM smoke OK${OFF}\n`);
