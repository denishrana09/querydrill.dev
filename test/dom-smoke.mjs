// Loads the real app module against the real page markup in jsdom and drives
// the main interactions. Catches the failure the other tests structurally
// cannot: correct logic wired to an element id that does not exist, which looks
// fine in every unit test and is a blank page in a browser.
//
//   node test/dom-smoke.mjs

import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { JSDOM } from 'jsdom';
// The count comes from the data, not a literal. These three assertions used to
// say 38, which quietly made "add an exercise" a change that broke the test
// suite - found by following CONTRIBUTING.md and adding one.
import { EXERCISES } from '../server/exercises/index.js';

const TOTAL = EXERCISES.length;

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
// Bare `location` and `history` are globals in a browser and not in Node, so
// without these the deep-link handling throws on import - which is precisely
// the class of bug this file exists to catch.
globalThis.location = dom.window.location;
globalThis.history = dom.window.history;

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
check('exercise list renders', $('exerciseList').querySelectorAll('.ex').length === TOTAL,
  `got ${$('exerciseList').querySelectorAll('.ex').length} of ${TOTAL}`);
check('progress shows a total', $('progress').textContent.includes(`/${TOTAL} passed`),
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

// --- help ladder: one button that escalates, rather than three ---
const withScaffold = EXERCISES.find((e) => e.track === 'fundamentals' && e.scaffold);
const idx = EXERCISES.indexOf(withScaffold);
const cards = [...$('exerciseList').querySelectorAll('.ex .ex-title')];
cards[idx].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const helpCard = $('exerciseList').querySelector('.ex.open');
const helpBtn = [...helpCard.querySelectorAll('.ex-actions button')].find((b) => !b.classList.contains('primary'));

check('help ladder starts at Hint', helpBtn.textContent === 'Hint', helpBtn.textContent);
check('only two buttons on a card', helpCard.querySelectorAll('.ex-actions button').length === 2,
  `${helpCard.querySelectorAll('.ex-actions button').length} buttons`);

helpBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('first click shows the hint', Boolean(helpCard.querySelector('.ex-hint')));
check('label advances to the shape', helpBtn.textContent === 'Show the shape', helpBtn.textContent);

helpBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('second click loads the scaffold', $('editor').value === withScaffold.scaffold, $('editor').value);
check('label advances to the solution', helpBtn.textContent === 'Show solution', helpBtn.textContent);

helpBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('third click reveals the solution',
  helpCard.querySelector('.ex-solution')?.textContent === withScaffold.solution);
check('ladder ends disabled', helpBtn.disabled);

// --- copy ---
let copied = null;
// Node 22 exposes a read-only `navigator` global, so it has to be redefined
// rather than assigned. jsdom has no clipboard implementation either way.
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { clipboard: { writeText: async (t) => { copied = t; } } },
});
$('editor').value = 'db.users.find({})';
$('copyQueryBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 10; i++) await tick();
check('copy query puts the editor text on the clipboard', copied === 'db.users.find({})', copied);

// --- format ---
$('editor').value = 'db.users.find({status:"active"},{_id:0,name:1})';
$('formatBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 200; i++) await tick();
// A short query correctly stays on one line - what must change is the spacing.
check('format normalises spacing',
  $('editor').value === 'db.users.find({ status: "active" }, { _id: 0, name: 1 })',
  JSON.stringify($('editor').value));
check('format does not add a trailing comma before )', !/,\s*\)/.test($('editor').value),
  JSON.stringify($('editor').value));

// A pipeline past the print width must wrap onto multiple lines.
$('editor').value = 'db.orders.aggregate([{$match:{status:"completed"}},{$group:{_id:"$items.category",n:{$sum:1}}},{$sort:{n:-1}}])';
$('formatBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 200; i++) await tick();
check('format wraps a long pipeline',
  $('editor').value.split('\n').length > 3 && $('editor').value.includes('$items.category'),
  JSON.stringify($('editor').value.slice(0, 60)));

$('editor').value = 'db.users.find({ status: "active"';
$('formatBtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 200; i++) await tick();
check('format reports where a broken query fails',
  /line \d+/.test($('toast').textContent), $('toast').textContent);
check('format leaves a broken query untouched',
  $('editor').value === 'db.users.find({ status: "active"');

// The splitter must be usable without a mouse.
const pane = document.querySelector('.editor-pane');
const before = pane.style.getPropertyValue('--editor-h');
$('splitter').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
check('splitter responds to the keyboard',
  pane.style.getPropertyValue('--editor-h') !== before,
  `${before || '(unset)'} -> ${pane.style.getPropertyValue('--editor-h')}`);

// --- deep links: the seam between the static lesson pages and the app ---
// Every lesson and module page links to /practice/#<id>. If this stops working
// the pages still render and the links still resolve, so nothing else notices.
const target = EXERCISES[12];
dom.window.location.hash = `#${target.id}`;
dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
await tick();

const opened = $('exerciseList').querySelector('.ex.open .ex-name');
check('a hash deep link opens that exercise', opened?.textContent === target.title,
  `${opened?.textContent} !== ${target.title}`);
check('a deep link loads the exercise into the editor',
  $('editor').value === target.starter);
check('an open exercise offers its lesson',
  $('exerciseList').querySelector('.ex.open .lesson-link')?.getAttribute('href') ===
    `/learn/${target.lesson}/`,
  $('exerciseList').querySelector('.ex.open .lesson-link')?.getAttribute('href'));

const other = EXERCISES[3];
const allCards = [...$('exerciseList').querySelectorAll('.ex .ex-title')];
allCards[EXERCISES.indexOf(other)].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
check('opening an exercise writes it to the hash',
  dom.window.location.hash === `#${other.id}`, dom.window.location.hash);

dom.window.location.hash = '#not-a-real-exercise';
dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
await tick();
check('an unknown hash leaves the open exercise alone',
  $('exerciseList').querySelector('.ex.open .ex-name')?.textContent === other.title);

/* ---------- panes on a narrow screen ---------- */

// jsdom loads no stylesheet, so the tab bar's computed display is `block` and the
// app behaves as it does on a phone. That is the state worth driving here: on a
// desktop the `on` class is inert and there is nothing to test.
const tab = (label) => [...$('tabbar').querySelectorAll('button')]
  .find((b) => b.textContent.trim().startsWith(label));

check('the tab bar offers all three panes', $('tabbar').querySelectorAll('button').length === 3);
check('the editor is the pane you land on',
  $('paneEditor').classList.contains('on') && tab('Editor').getAttribute('aria-pressed') === 'true');
check('the tab bar carries the progress count while its pane is hidden',
  new RegExp(`^\\d+/${TOTAL}$`).test($('tabCount').textContent), $('tabCount').textContent);

tab('Data').click();
check('tapping a tab shows that pane and only that pane',
  $('paneData').classList.contains('on') &&
  !$('paneEditor').classList.contains('on') &&
  !$('paneExercises').classList.contains('on'));
check('and moves the pressed state with it',
  tab('Data').getAttribute('aria-pressed') === 'true' &&
  tab('Editor').getAttribute('aria-pressed') === 'false');

// The failure this guards against: tapping a drill in the exercises view loads it
// into an editor you cannot see, so the app looks like it ignored the tap.
tab('Exercises').click();
$('exerciseList').querySelector('.ex .ex-name').click();
await tick();
check('opening an exercise brings the editor back with it',
  $('paneEditor').classList.contains('on') && $('editor').value.length > 0);

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} failure(s):${OFF}`);
  for (const f of failures) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ${GREEN}DOM smoke OK${OFF}\n`);
