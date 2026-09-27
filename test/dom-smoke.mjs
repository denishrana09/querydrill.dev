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
import { MODULES } from '../content/curriculum.js';
import { filtersFor, labelOf } from '../content/topics.js';

const TOTAL = EXERCISES.length;
const FILTERS = filtersFor(EXERCISES);

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

// The whole point of the mistake notes is when they appear, so this has to be
// asserted on a card that has been opened and never answered - here, and not
// down with the rest of them. Written there first, it was vacuous: the passing
// check that comes before it clears `.ex-mistakes` itself, so it went on passing
// with the notes rendered eagerly into every card. The second half of the
// condition stops it passing because the drill has nothing to show.
check('nothing about mistakes before an attempt fails',
  openCard.querySelector('.ex-mistakes') === null && EXERCISES[0].mistakes?.length > 0);

// The order chip has to agree with the flag the grader reads, not just exist -
// a card promising "any order" on an order-graded drill is worse than silence.
const orderChip = openCard.querySelector('.chip.order');
const first = EXERCISES[0];
check('the card says whether row order is graded',
  orderChip?.textContent === (first.unordered ? 'any order' : 'order matters'),
  `${first.id} is ${first.unordered ? 'unordered' : 'ordered'}, chip says "${orderChip?.textContent}"`);

// Write drills return an update result and their verify query fixes the order,
// so claiming either way would be a guess dressed up as a fact.
const writeEx = EXERCISES.find((e) => e.type === 'write');
const writeCard = [...$('exerciseList').querySelectorAll('.ex .ex-name')]
  .find((n) => n.textContent === writeEx.title);
writeCard.click();
await tick();
check('write drills claim nothing about row order',
  $('exerciseList').querySelector('.ex.open .chip.order') === null,
  $('exerciseList').querySelector('.ex.open .chip.order')?.textContent);
writeCard.click();
await tick();
firstCard.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
await tick();

$('editor').value = EXERCISES[0].solution;
openCard.querySelector('.ex-actions button.primary')
  .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
for (let i = 0; i < 40; i++) await tick();

const feedback = openCard.querySelector('.ex-feedback');
check('checking a correct answer gives passing feedback',
  Boolean(feedback) && feedback.classList.contains('pass'), feedback?.textContent);
check('progress is written to localStorage',
  JSON.parse(localStorage.getItem('mp.progress') || '{}')[EXERCISES[0].id] === 'pass');

// --- what usually goes wrong: after a failed attempt, and only then ---

// "Nothing before a failure" is asserted further up, on a card that has not been
// answered yet. It cannot be asserted here: the passing check just above removes
// `.ex-mistakes` on its way in, so at this point the absence proves nothing.

const pressCheck = () => {
  openCard.querySelector('.ex-actions button.primary')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
};

// Runs fine, returns rows, wrong answer - the failure the notes exist for.
$('editor').value = 'db.users.find({})';
pressCheck();
for (let i = 0; i < 40; i++) await tick();

const mistakes = openCard.querySelector('.ex-mistakes');
check('a wrong answer shows what usually goes wrong', Boolean(mistakes));
check('it lists every note the drill has',
  mistakes?.querySelectorAll('li').length === EXERCISES[0].mistakes?.length,
  `${mistakes?.querySelectorAll('li').length} of ${EXERCISES[0].mistakes?.length}`);
// Below the diff, never above it. The diff is what gets read first; this
// explains it. Both are re-appended on every failed check to keep that order,
// so a retry cannot silently flip them.
check('it sits after the feedback, not before',
  openCard.querySelector('.ex-feedback')
    ?.compareDocumentPosition(mistakes) === dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
check('the notes render markdown backticks as code',
  mistakes?.querySelector('code') !== null);

// A query that throws is a failed attempt too - a separate branch in the app,
// and one where the learner has even less to go on than a diff.
$('editor').value = 'db.users.find({';
pressCheck();
for (let i = 0; i < 40; i++) await tick();
check('a query that errors shows them as well',
  Boolean(openCard.querySelector('.ex-mistakes')) &&
  openCard.querySelector('.ex-feedback .head').textContent === 'Your query errored:');

// And getting it right takes them away again, rather than leaving a list of
// things to worry about under a green tick.
$('editor').value = EXERCISES[0].solution;
pressCheck();
for (let i = 0; i < 40; i++) await tick();
check('passing clears them again', openCard.querySelector('.ex-mistakes') === null);
check('passing still gives passing feedback',
  openCard.querySelector('.ex-feedback')?.classList.contains('pass'));

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

/* ---------- topic filters ---------- */

const fchip = (label) => [...$('exFilters').querySelectorAll('button')]
  .find((b) => b.querySelector('span')?.textContent === label);

const shownTitles = () => [...$('exerciseList').querySelectorAll('.ex .ex-name')].map((n) => n.textContent);

const filterTags = [...$('exFilters').querySelectorAll('button')].map((b) => b.dataset.tag);
check('the filter row is built from the promoted tags',
  filterTags.length === FILTERS.length + 1 && filterTags[0] === '',
  `${filterTags.length} chips: ${filterTags.join(' ')}`);
check('every filter chip carries its own count',
  [...$('exFilters').querySelectorAll('button')].every((b) => /^\d+$/.test(b.querySelector('.fcount').textContent)));
check('All starts pressed', fchip('All').getAttribute('aria-pressed') === 'true');
check('an unfiltered list shows every drill', shownTitles().length === TOTAL, `${shownTitles().length}`);

// $group is the biggest filter, so a wrong implementation that shows everything
// or nothing is unambiguous rather than off by one.
const groupCount = EXERCISES.filter((e) => e.topics.includes('$group')).length;
fchip('$group').click();
await tick();
check('clicking a chip narrows the list to that topic',
  shownTitles().length === groupCount && shownTitles().length < TOTAL,
  `${shownTitles().length} shown, ${groupCount} tagged $group`);
check('and the pressed state moves off All',
  fchip('$group').getAttribute('aria-pressed') === 'true' &&
  fchip('All').getAttribute('aria-pressed') === 'false');
check('every drill still shown really carries the tag',
  [...$('exerciseList').querySelectorAll('.ex .ex-name')].every((n) =>
    EXERCISES.find((e) => e.title === n.textContent)?.topics.includes('$group')));

// A module whose drills are all filtered out must take its heading with it, and
// so must a track - an empty heading reads as a module that lost its content.
const headings = [...$('exerciseList').querySelectorAll('.ex-module > h4 span:first-child')]
  .map((h) => h.textContent);
check('modules with nothing left are dropped entirely',
  headings.every((title) => {
    const mod = MODULES.find((m) => m.title === title);
    return EXERCISES.some((e) => e.module === mod?.slug && e.topics.includes('$group'));
  }), headings.join(' | '));
check('a track with no matching drills is dropped too',
  $('exerciseList').querySelectorAll('.track-head').length <
    new Set(MODULES.map((m) => m.track)).size,
  `${$('exerciseList').querySelectorAll('.track-head').length} track headings`);

check('overall progress still counts the whole course, not the filtered view',
  $('progress').textContent.includes(`/${TOTAL} passed`), $('progress').textContent);

// Clicking the active chip is the other way out, so All is not the only one.
fchip('$group').click();
await tick();
check('clicking the active chip clears the filter',
  shownTitles().length === TOTAL && fchip('All').getAttribute('aria-pressed') === 'true',
  `${shownTitles().length} shown`);

// Filtering away an open drill must not leave its Check button in a hidden card,
// and must not take the editor's contents with it.
//
// The state is set up explicitly rather than by clicking the first card, because
// a click toggles: if a drill were already open, clicking would close it and the
// rest of this block would read a null card and throw. That is exactly what
// happened when the collapse was deliberately removed to check this test fails -
// it did fail, by crashing, which is not a message anyone can act on.
if (!$('exerciseList').querySelector('.ex.open')) {
  $('exerciseList').querySelector('.ex .ex-name').click();
  await tick();
}
const openName = $('exerciseList').querySelector('.ex.open .ex-name');
check('a drill can be opened before filtering it away', openName !== null);

if (openName) {
  const openTitle = openName.textContent;
  const openEx = EXERCISES.find((e) => e.title === openTitle);
  const away = FILTERS.find((f) => !openEx.topics.includes(f.slug));
  $('editor').value = 'db.users.find({ mine: true })';
  fchip(labelOf(away.slug)).click();
  await tick();
  check('a filter that hides the open drill hides its card',
    $('exerciseList').querySelector('.ex.open') === null,
    `${openTitle} is still open under the ${labelOf(away.slug)} filter`);
  check('and does not take the editor contents with it',
    $('editor').value === 'db.users.find({ mine: true })', $('editor').value);

  // The check that actually needs the collapse. The card disappearing above
  // happens either way - a drill outside the filter is simply never rendered.
  // What the collapse buys is that `openId` does not stay pointing at it: leave
  // it set and the drill springs back open when the filter clears, and the next
  // click on that card *closes* it, which reads as the list ignoring you.
  fchip('All').click();
  await tick();
  check('and it stays closed once the filter is cleared',
    $('exerciseList').querySelector('.ex.open') === null,
    `${openTitle} reopened itself`);
}

/* ---------- arriving from a topic page ---------- */

// `/practice/?topic=$lookup` is what the topic hubs link to, and the app reads
// it once at startup - so it cannot be tested by poking the running instance.
// A second document with the query string on it, and a second import, is the
// only way to exercise the same path the link takes. The cache-busting suffix
// is what makes the module body run again; without it Node hands back the
// instance already bound to the first document and the check passes on nothing.
{
  const target = FILTERS[FILTERS.length - 1];   // the smallest chip, so a wrong filter is obvious
  const fresh = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url: `https://example.com/practice/?topic=${encodeURIComponent(target.slug)}`,
  });
  globalThis.window = fresh.window;
  globalThis.document = fresh.window.document;
  globalThis.localStorage = fresh.window.localStorage;
  globalThis.getComputedStyle = fresh.window.getComputedStyle.bind(fresh.window);
  globalThis.location = fresh.window.location;
  globalThis.history = fresh.window.history;

  await import('../src/scripts/app.js?from-a-topic-page');
  await tick();

  const $$ = (id) => fresh.window.document.getElementById(id);
  const shown = [...$$('exerciseList').querySelectorAll('.ex')];
  const want = EXERCISES.filter((e) => e.topics.includes(target.slug));
  check(`?topic=${target.slug} opens the list already narrowed to it`,
    shown.length === want.length && shown.length < TOTAL,
    `${shown.length} drills shown, ${want.length} carry the tag, ${TOTAL} in total`);

  const pressed = [...$$('exFilters').querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-pressed') === 'true');
  check('and the chip for that topic is the pressed one',
    pressed?.dataset.tag === target.slug, `pressed: ${pressed?.dataset.tag ?? '(none)'}`);

  // A tag that is real but has no chip, or one somebody invented, must not leave
  // the visitor staring at an empty course.
  const bogus = new JSDOM(`<!doctype html><html><body>${body}</body></html>`, {
    url: 'https://example.com/practice/?topic=$nonsense',
  });
  globalThis.window = bogus.window;
  globalThis.document = bogus.window.document;
  globalThis.localStorage = bogus.window.localStorage;
  globalThis.getComputedStyle = bogus.window.getComputedStyle.bind(bogus.window);
  globalThis.location = bogus.window.location;
  globalThis.history = bogus.window.history;

  await import('../src/scripts/app.js?with-a-bogus-topic');
  await tick();
  check('an unknown ?topic= shows the whole course rather than nothing',
    bogus.window.document.getElementById('exerciseList').querySelectorAll('.ex').length === TOTAL);
}

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} failure(s):${OFF}`);
  for (const f of failures) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ${GREEN}DOM smoke OK${OFF}\n`);
