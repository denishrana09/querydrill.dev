// Practice app. Everything below runs in the tab: there is no server, no fetch,
// and nothing leaves the browser. The dataset is rebuilt from a seeded PRNG, so
// "reset data" is exact rather than approximate.

import { makeMingoDb } from '../../engine/mingo-db.js';
import { runCode } from '../../engine/run.js';
import { gradeExercise } from '../../engine/grade.js';
import { esc, highlight } from '../../engine/format.js';
import ecommerce from '../../server/datasets/ecommerce.js';
import { inferSchema } from './schema.js';
import { attachEditor } from './editor.js';
import { EXERCISES } from '../../server/exercises/index.js';
import { MODULES, TRACKS, ALL_LESSONS } from '../../content/curriculum.js';
import { labelOf, filtersFor } from '../../content/topics.js';
import { migrateKeys } from '../../content/legacy-ids.js';

const $ = (id) => document.getElementById(id);

/**
 * The textarea in the markup, upgraded to CodeMirror as soon as its chunk
 * arrives. Everything below talks to this and never to the element, because for
 * the first moment of every visit - and for good, if that chunk fails - the two
 * are not the same thing. See src/scripts/editor.js.
 *
 * Attached here, before anything can set a value: a deep link opens a drill and
 * fills the editor during this module's own startup.
 */
const editor = attachEditor($('editor'), {
  onRun: () => run(),
  onFormat: () => formatQuery(),
  fields: fieldsOf,
});

// The editor asks what fields a collection has; this is the only place that
// knows. inferSchema walks every document, so it is cached - and the cache is
// dropped whenever the data changes, because a write can add a field and an
// autocomplete that is confidently out of date is worse than none.
const schemaCache = new Map();
function fieldsOf(name) {
  const docs = state.store?.[name];
  if (!docs?.length) return null;
  if (!schemaCache.has(name)) schemaCache.set(name, inferSchema(docs));
  return schemaCache.get(name);
}

const LESSON_BY_SLUG = new Map(ALL_LESSONS.map((l) => [l.slug, l]));
const LS_PROGRESS = 'mp.progress';
const LS_DRAFTS = 'mp.drafts';
const LS_SPLIT = 'mp.split';

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

const state = {
  store: null,
  db: null,
  current: null,
  openId: null,
  // Which topic the drill list is narrowed to, '' for all of them. Deliberately
  // not persisted: coming back to find two thirds of the course missing, because
  // of a chip you clicked last week, is a bug that looks like lost content.
  filter: '',
  collection: null,
  showRaw: false,
  dirty: false,
  progress: migrateKeys(load(LS_PROGRESS, {})),
  drafts: migrateKeys(load(LS_DRAFTS, {})),
};
// Write the migrated shape straight back, so the b1-01 keys are gone for good
// rather than being re-translated on every visit.
save(LS_PROGRESS, state.progress);
save(LS_DRAFTS, state.drafts);

function loadDataset() {
  state.store = ecommerce.build();
  state.dirty = false;
  schemaCache.clear();
  // The engine reports the moment a query writes anything, which is the only
  // time offering to restore the data means something to the learner.
  state.db = makeMingoDb(state.store, 'practice', {
    onMutate: () => { state.dirty = true; schemaCache.clear(); },
  });
}
loadDataset();

/* ---------- chrome ---------- */

let toastTimer;
function toast(message, bad = false) {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* ---------- rendering results ---------- */

function renderResult(payload) {
  const meta = $('resultMeta');
  const body = $('resultBody');

  if (!payload.ok) {
    meta.innerHTML = `<span class="err">error</span> · ${payload.ms}ms`;
    body.textContent = payload.error;
    $('copyResultBtn').hidden = false;
    return;
  }

  const bits = ['<span class="ok">ok</span>', `${payload.ms}ms`];
  if (payload.totalRows != null) {
    bits.push(`${payload.totalRows} row${payload.totalRows === 1 ? '' : 's'}`);
  }
  if (payload.truncated) bits.push('showing first 200');
  if (payload.isUndefined) bits.push('no value returned — add a `return` for multi-statement code');
  meta.innerHTML = bits.join(' · ');
  body.innerHTML = highlight(payload.value);
  $('copyResultBtn').hidden = false;
}

/* ---------- collections sidebar ---------- */

function renderCollections() {
  const list = $('collections');
  list.innerHTML = '';
  for (const name of Object.keys(state.store).sort()) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(name)}</span><span class="n">${state.store[name].length}</span>`;
    li.onclick = () => selectCollection(name, li);
    list.appendChild(li);
  }
}

function selectCollection(name, li) {
  document.querySelectorAll('.collections li').forEach((n) => n.classList.remove('active'));
  li?.classList.add('active');
  state.collection = name;
  setEditor(`db.${name}.find().limit(5)`);
  renderSidebarDetail();
}

function renderSidebarDetail() {
  const name = state.collection;
  const schema = $('schema');
  const raw = $('sampleDoc');

  $('schemaTitle').textContent = name ? `Fields \u00b7 ${name}` : 'Fields';
  $('rawToggle').textContent = state.showRaw ? 'field list' : 'raw doc';
  $('rawToggle').hidden = !name;

  if (!name) {
    schema.innerHTML = '<p class="muted">pick a collection</p>';
    schema.hidden = false;
    raw.hidden = true;
    return;
  }

  const docs = state.store[name] || [];

  if (state.showRaw) {
    schema.hidden = true;
    raw.hidden = false;
    raw.innerHTML = docs[0] ? highlight(docs[0]) : '<span class="muted">empty collection</span>';
    return;
  }

  raw.hidden = true;
  schema.hidden = false;
  schema.innerHTML = '';

  if (!docs.length) {
    schema.innerHTML = '<p class="muted">empty collection</p>';
    return;
  }

  for (const f of inferSchema(docs)) {
    const row = document.createElement('div');
    row.className = `row d${f.depth}` + (f.type === 'array' ? ' arr' : '');
    const pct = Math.round(f.presence * 100);
    const optional = f.presence < 1
      ? ` <span class="opt" title="present in ${pct}% of documents">${pct}%</span>`
      : '';
    row.innerHTML =
      `<span class="nm">${esc(f.name)}</span>` +
      `<span class="ty">${esc(f.type)}${optional}</span>`;
    row.title = `${f.path}${f.sample ? '  e.g. ' + f.sample : ''}`;
    // Inserting the dotted path is how dot notation stops being abstract.
    row.onclick = () => { editor.insert(f.path); editor.focus(); };
    schema.appendChild(row);
  }
}

/* ---------- editor ---------- */

function setEditor(text) {
  editor.value = text;
  editor.focus();
}

async function run() {
  const code = editor.value.trim();
  if (!code) return;

  if (state.current) {
    state.drafts[state.current.id] = editor.value;
    save(LS_DRAFTS, state.drafts);
  }

  // The empty-state note has done its job the moment anything runs.
  $('resultHint')?.remove();

  $('resultMeta').textContent = 'running…';
  renderResult(await runCode(state.db, code));
  renderCollections();     // a write query changes the counts
  renderSidebarDetail();   // ...and can change the shape
  $('dirtyBar').hidden = !state.dirty;
}

/* ---------- format & copy ---------- */

/**
 * Prettier is ~390KB, which is eight times the whole app - so it is imported
 * only when someone actually presses Format. Vite splits it into its own chunk
 * and the initial load never pays for it.
 */
let prettierPromise = null;

function loadPrettier() {
  // Cached so repeat clicks do not re-import, and so a failed load can be
  // retried rather than being permanently poisoned.
  prettierPromise ??= Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]).catch((err) => {
    prettierPromise = null;
    throw Object.assign(new Error('formatter failed to load'), { loadFailure: true, cause: err });
  });
  return prettierPromise;
}

async function formatQuery() {
  const source = editor.value.trim();
  if (!source) return;

  const btn = $('formatBtn');
  btn.disabled = true;
  try {
    const [prettier, babel, estree] = await loadPrettier();
    const out = await prettier.format(source, {
      parser: 'babel',
      plugins: [babel.default ?? babel, estree.default ?? estree],
      printWidth: 68,
      semi: false,
      trailingComma: 'none',   // a trailing comma before ) is not shell style
    });
    // Through the editor rather than at the element, so in CodeMirror this lands
    // in the undo history: Ctrl+Z after a Format gives back what you wrote.
    editor.value = out.trim();
    editor.focus();
  } catch (err) {
    // Two very different failures. A load failure is about the network and is
    // worth retrying; a syntax error is about the query and never is.
    if (err?.loadFailure) {
      toast('Formatter could not load — check your connection and try again.', true);
    } else {
      // A query mid-edit is usually unparseable, so say where rather than just no.
      const loc = err?.loc?.start ?? err?.loc;
      toast(
        loc?.line
          ? `Can't format — syntax error at line ${loc.line}, column ${loc.column ?? 0}`
          : `Can't format — ${String(err?.message || err).split('\n')[0]}`,
        true
      );
    }
  } finally {
    btn.disabled = false;
  }
}

async function copyText(text, btn) {
  if (!text) return;
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    btn.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => { btn.textContent = original; }, 1400);
}

/* ---------- exercises ---------- */

const markdownish = (text) =>
  esc(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');

function renderProgress() {
  const done = EXERCISES.filter((e) => state.progress[e.id] === 'pass').length;
  $('progress').textContent = `${done}/${EXERCISES.length} passed`;
  // The exercises pane is hidden on a narrow screen, so the count moves to the tab.
  $('tabCount').textContent = `${done}/${EXERCISES.length}`;
}

/* ---------- topic filters ---------- */

// Only the tags that earned a chip - see content/topics.js. Making all 56
// clickable would put 29 chips in this row that return the single drill you were
// already looking at, and a row nobody can scan is the thing being fixed.
const FILTERS = filtersFor(EXERCISES);

/**
 * `/practice/?topic=$lookup` opens the list already narrowed to that topic. The
 * topic hub pages link in this way, so the button that says "Practise $lookup"
 * lands on the four $lookup drills rather than on all 38 with no explanation.
 *
 * This is not the same decision as remembering the filter between visits, which
 * stays rejected: arriving to find two thirds of the course missing, because of
 * a chip clicked last week, is a bug that looks like lost content. A link that
 * says in its own URL which topic it means is not that.
 *
 * Ignored unless it names a topic that really has a chip, so a stale or
 * hand-edited URL shows the whole course instead of an empty list.
 */
function filterFromQuery() {
  try {
    const want = new URLSearchParams(location.search).get('topic');
    return want && FILTERS.some((f) => f.slug === want) ? want : '';
  } catch {
    return '';
  }
}
state.filter = filterFromQuery();

/** The drills the current filter admits. */
const visible = () =>
  state.filter ? EXERCISES.filter((e) => e.topics.includes(state.filter)) : EXERCISES;

function renderFilters() {
  const host = $('exFilters');

  if (host.children.length) {
    // Built once. Re-rendering the row on every click would throw away the
    // scroll position, which on a phone is the row itself.
    for (const b of host.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.tag === state.filter));
    }
    return;
  }

  const chip = (tag, label, count) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fchip';
    b.dataset.tag = tag;
    b.setAttribute('aria-pressed', String(tag === state.filter));
    b.innerHTML = `<span>${esc(label)}</span><span class="fcount">${count}</span>`;
    return b;
  };

  host.appendChild(chip('', 'All', EXERCISES.length));
  for (const f of FILTERS) host.appendChild(chip(f.slug, labelOf(f.slug), f.count));

  host.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tag]');
    if (!b) return;
    // Clicking the active chip clears it, so All is not the only way back out.
    state.filter = b.dataset.tag === state.filter ? '' : b.dataset.tag;
    renderExercises();
  });
}

function renderExercises() {
  const host = $('exerciseList');
  host.innerHTML = '';

  const shown = visible();
  // A drill left open behind a filter that hides it keeps the Check button in a
  // card nobody can see. The editor is deliberately left alone - throwing away
  // someone's half-written query to apply a filter would be much worse.
  if (state.openId && !shown.some((e) => e.id === state.openId)) state.openId = null;
  renderFilters();

  // Modules, grouped under their track. The three 15-exercise "batches" were a
  // sitting nobody finishes; a module is four to six drills on one idea.
  for (const track of TRACKS) {
    const modules = MODULES.filter((m) => m.track === track.slug);
    // A whole track can be empty under a filter, and an empty track heading
    // reads as a module that lost its drills.
    if (!modules.some((m) => shown.some((e) => e.module === m.slug))) continue;

    const trackHead = document.createElement('h3');
    trackHead.className = 'track-head';
    trackHead.textContent = track.title;
    host.appendChild(trackHead);

    for (const module of modules) {
      const group = shown.filter((e) => e.module === module.slug);
      if (!group.length) continue;

      const wrap = document.createElement('section');
      wrap.className = 'ex-module';

      const done = group.filter((e) => state.progress[e.id] === 'pass').length;
      const heading = document.createElement('h4');
      heading.innerHTML =
        `<span>${esc(module.title)}</span>` +
        `<span class="count${done === group.length ? ' all' : ''}">${done}/${group.length}</span>`;
      heading.title = module.goal;
      wrap.appendChild(heading);

      for (const ex of group) wrap.appendChild(renderExercise(ex));
      host.appendChild(wrap);
    }
  }
  renderProgress();
}

function renderExercise(ex) {
  const status = state.progress[ex.id];
  const open = state.openId === ex.id;

  const card = document.createElement('div');
  card.className = 'ex' + (open ? ' open' : '') + (status ? ' ' + status : '');

  const title = document.createElement('div');
  title.className = 'ex-title';
  // The old `b1-01` label named a filing position, not the exercise. Difficulty
  // is what someone actually scans a list for.
  title.innerHTML =
    `<span class="diff ${ex.difficulty}" title="${ex.difficulty}"></span>` +
    `<span class="ex-name">${esc(ex.title)}</span>` +
    (ex.type === 'write' ? '<span class="tag">write</span>' : '') +
    `<span class="mark ${status || ''}">${status === 'pass' ? '✓' : status === 'fail' ? '✗' : ''}</span>`;
  title.onclick = () => {
    state.openId = open ? null : ex.id;
    if (!open) selectExercise(ex);
    // Keep the hash in step so the open exercise is linkable and survives a
    // reload. replaceState rather than the hash property: setting the hash
    // pushes a history entry per click, which turns Back into a chore.
    history.replaceState(null, '', open ? location.pathname : `#${ex.id}`);
    renderExercises();
  };
  card.appendChild(title);
  if (!open) return card;

  const body = document.createElement('div');
  body.className = 'ex-body';

  const chips = document.createElement('div');
  chips.className = 'chips';
  // Whether row order is graded comes from the same flag engine/compare.js reads,
  // so the card and the grader cannot drift apart - which is why this is a chip
  // rather than a sentence repeated in nine prompts. Write drills say nothing:
  // you return an update result, and the verify query decides the order.
  const order = ex.type === 'write'
    ? ''
    : `<span class="chip order">${ex.unordered ? 'any order' : 'order matters'}</span>`;

  chips.innerHTML =
    `<span class="chip ${ex.difficulty}">${ex.difficulty}</span>` +
    order +
    ex.topics.map((t) => `<span class="chip">${esc(labelOf(t))}</span>`).join('');
  body.appendChild(chips);

  const prompt = document.createElement('div');
  prompt.className = 'ex-prompt';
  prompt.innerHTML = markdownish(ex.prompt);
  body.appendChild(prompt);

  // The way back out of a drill you cannot do. Every exercise names the lesson
  // that teaches it, so this is never a guess.
  const lesson = LESSON_BY_SLUG.get(ex.lesson);
  if (lesson) {
    const link = document.createElement('a');
    link.className = 'lesson-link';
    link.href = `/learn/${lesson.slug}/`;
    link.textContent = `Read: ${lesson.title}`;
    body.appendChild(link);
  }

  const actions = document.createElement('div');
  actions.className = 'ex-actions';

  const check = document.createElement('button');
  check.className = 'primary';
  check.textContent = 'Check';
  check.onclick = () => checkAnswer(ex, body, check);
  actions.appendChild(check);

  // One escalating button rather than three. Three crowded the card and let
  // someone jump straight past the hint to the answer; this walks the ladder in
  // order, and each label says what the next click will do.
  const help = document.createElement('button');
  help.className = 'ghost';

  const steps = [
    { label: 'Hint', run: () => showHint(ex, body) },
    // Starters give only the call and empty slots; this restores the heavier
    // scaffold, so a thin default never strands a beginner.
    ...(ex.scaffold ? [{ label: 'Show the shape', run: () => setEditor(ex.scaffold) }] : []),
    // The last rung needs an attempt behind it. Not to be strict - anything at
    // all counts, and a wrong answer is the point - but because reading the
    // solution to a question you have not tried teaches nothing, and the ladder
    // is otherwise a three-click path straight to the answer.
    { label: 'Show solution', run: () => (state.progress[ex.id] ? revealSolution(ex, body) : askForAnAttempt(body)) },
  ];

  let step = 0;
  help.textContent = steps[0].label;
  help.onclick = () => {
    if (steps[step].run() === false) return; // reveal was cancelled
    step += 1;
    if (step >= steps.length) help.disabled = true;
    else help.textContent = steps[step].label;
  };
  actions.appendChild(help);

  body.appendChild(actions);

  card.appendChild(body);
  return card;
}

/* ---------- panes on a narrow screen ---------- */

// Whether the panes are views or columns is read off the tab bar's own computed
// style, so the breakpoint lives in one place - the stylesheet - instead of being
// copied into a matchMedia query that then drifts from it.
const narrow = () => getComputedStyle($('tabbar')).display !== 'none';

function showPane(id) {
  for (const pane of document.querySelectorAll('.pane')) {
    pane.classList.toggle('on', pane.id === id);
  }
  for (const tab of $('tabbar').querySelectorAll('button')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.pane === id));
  }
  // The editor was just inside a display:none pane, so every height and caret
  // position CodeMirror had cached is zero. Harmless above the breakpoint, where
  // the pane was never hidden in the first place.
  if (id === 'paneEditor') editor.refresh();
}

$('tabbar').addEventListener('click', (e) => {
  const tab = e.target.closest('button[data-pane]');
  if (tab) showPane(tab.dataset.pane);
});

// The class is inert above the breakpoint - the media query is what gives it
// meaning - so this is safe to set once on every screen size.
showPane('paneEditor');

function selectExercise(ex) {
  state.current = ex;
  setEditor(state.drafts[ex.id] ?? ex.starter);
  // On a phone the exercise list and the editor are different views, so opening a
  // drill has to bring the editor with it or it looks like nothing happened.
  if (narrow()) showPane('paneEditor');
  const module = MODULES.find((m) => m.slug === ex.module);
  $('editorLabel').textContent = `${module ? module.title + ' · ' : ''}${ex.title}`;
}

async function checkAnswer(ex, body, button) {
  body.querySelectorAll('.ex-feedback, .ex-mistakes').forEach((n) => n.remove());
  button.disabled = true;
  button.textContent = 'Checking…';

  const feedback = document.createElement('div');
  feedback.className = 'ex-feedback';

  const result = await gradeExercise(ecommerce, ex, editor.value);

  // A broken exercise is our fault, so it is not a failed attempt: nothing the
  // learner could read would help, and telling them what they usually get wrong
  // when the reference solution is the thing that threw would be a lie.
  let attemptFailed = false;

  if (!result.ok) {
    const head = result.internal ? 'This exercise is broken — please report it:' : 'Your query errored:';
    feedback.innerHTML = `<span class="head">${head}</span><ul><li>${esc(result.error)}</li></ul>`;
    if (!result.internal) {
      state.progress[ex.id] = 'fail';
      attemptFailed = true;
    }
  } else if (result.pass) {
    feedback.classList.add('pass');
    feedback.textContent = result.isWrite
      ? '✓ Correct. Grading used its own copy of the data, so your playground is untouched.'
      : '✓ Correct.';
    state.progress[ex.id] = 'pass';
  } else {
    // The hidden count is not itself a difference, so it is a caption under the
    // list rather than another bullet in it.
    feedback.innerHTML =
      '<span class="head">Not quite:</span><ul>' +
      result.diffs.map((d) => `<li>${esc(d)}</li>`).join('') +
      '</ul>' +
      (result.hidden ? `<span class="more">and ${result.hidden} more difference${result.hidden === 1 ? '' : 's'}</span>` : '');
    state.progress[ex.id] = 'fail';
    attemptFailed = true;
  }

  body.appendChild(feedback);
  if (attemptFailed) showMistakes(ex, body);
  state.drafts[ex.id] = editor.value;
  save(LS_PROGRESS, state.progress);
  save(LS_DRAFTS, state.drafts);
  renderProgress();

  // Repaint the card without collapsing it.
  const card = body.parentElement;
  const status = state.progress[ex.id] || '';
  card.className = ('ex open ' + status).trim();
  const mark = card.querySelector('.mark');
  mark.className = ('mark ' + status).trim();
  mark.textContent = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '';

  button.disabled = false;
  button.textContent = 'Check';
}

function showHint(ex, body) {
  if (body.querySelector('.ex-hint')) return;
  const el = document.createElement('div');
  el.className = 'ex-hint';
  el.innerHTML = markdownish(ex.hint || 'No hint for this one.');
  body.appendChild(el);
}

/**
 * What usually goes wrong on this drill - shown after a failed attempt, and only
 * then.
 *
 * Deliberately NOT a step on the help ladder. Read before trying, these are
 * hints with half the answer in them, which is exactly what several of them were:
 * the tail end of a hint, saying that summing price alone is the classic slip,
 * to someone who had not yet tried summing anything.
 *
 * Read straight after getting it wrong, they are the one thing the diff cannot
 * say. The diff reports that revenue came out 50 instead of 2000; this says why
 * adding a unit price without its quantity does that. Appended below the
 * feedback, and re-appended on every failed attempt, so the two always arrive in
 * the same order and a pass clears both.
 */
function showMistakes(ex, body) {
  if (!ex.mistakes?.length) return;
  const el = document.createElement('div');
  el.className = 'ex-mistakes';
  el.innerHTML =
    '<span class="head">What usually goes wrong here</span><ul>' +
    ex.mistakes.map((m) => `<li>${markdownish(m)}</li>`).join('') +
    '</ul>';
  body.appendChild(el);
}

/** @returns false if the learner backed out, so the help ladder does not advance. */
/**
 * The answer to "Show solution" before anything has been checked. Returns false
 * so the ladder does not advance - the rung is still there once they have tried.
 *
 * A disabled button would be worse: it says no without saying why, and the way
 * past it is not obvious from looking at it.
 */
function askForAnAttempt(body) {
  let note = body.querySelector('.ex-gate');
  if (!note) {
    note = document.createElement('div');
    note.className = 'ex-gate';
    note.textContent =
      'Press Check on an answer first — any answer. Getting it wrong is what the ' +
      'feedback is for, and the solution is here afterwards.';
    body.appendChild(note);
  }
  return false;
}

function revealSolution(ex, body) {
  if (body.querySelector('.ex-solution')) return true;
  const ok = confirm(
    'Show the reference solution?\n\n' +
    'Reading the answer now is what stops this from being practice.'
  );
  if (!ok) return false;
  const el = document.createElement('div');
  el.className = 'ex-solution';
  el.textContent = ex.solution;
  body.appendChild(el);
  return true;
}

/* ---------- wiring ---------- */

$('runBtn').onclick = run;
$('formatBtn').onclick = formatQuery;
$('copyQueryBtn').onclick = (e) => copyText(editor.value, e.currentTarget);
// textContent, not the value: this copies exactly what is rendered, minus markup.
$('copyResultBtn').onclick = (e) => copyText($('resultBody').textContent, e.currentTarget);

$('resetBtn').onclick = () => setEditor(state.current ? state.current.starter : '');

$('resetDataBtn').onclick = () => {
  loadDataset();
  renderCollections();
  if (state.collection) {
    const li = [...$('collections').children]
      .find((n) => n.firstChild.textContent === state.collection);
    li?.classList.add('active');
  }
  renderSidebarDetail();
  $('dirtyBar').hidden = true;
  toast('Dataset restored.');
};

$('rawToggle').onclick = () => {
  state.showRaw = !state.showRaw;
  renderSidebarDetail();
};

/* Drag splitter. The editor height is a CSS variable rather than an inline
   height, so the flex basis and the drag share one source of truth - setting
   height directly is what made the old resize handle appear to do nothing. */
(function splitter() {
  const bar = $('splitter');
  const pane = document.querySelector('.editor-pane');
  const saved = load(LS_SPLIT, null);
  if (saved) pane.style.setProperty('--editor-h', saved);

  const clamp = (pct) => Math.min(80, Math.max(12, pct));
  const apply = (pct) => {
    const value = pct.toFixed(1) + '%';
    pane.style.setProperty('--editor-h', value);
    save(LS_SPLIT, value);
  };

  bar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging');

    const onMove = (ev) => {
      const paneBox = pane.getBoundingClientRect();
      // editor.el, not the textarea: once CodeMirror has taken over, the
      // textarea is gone and a dead reference measures as 0, which drags the
      // splitter to the top of the screen on the first pointer move.
      const top = editor.el.getBoundingClientRect().top;
      apply(clamp(((ev.clientY - top) / paneBox.height) * 100));
    };
    const onUp = () => {
      document.body.classList.remove('dragging');
      bar.removeEventListener('pointermove', onMove);
      bar.removeEventListener('pointerup', onUp);
    };
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
  });

  // Keyboard-reachable: a drag-only handle excludes anyone not using a mouse.
  bar.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowUp' ? -4 : e.key === 'ArrowDown' ? 4 : 0;
    if (!step) return;
    e.preventDefault();
    // Prefer the inline value the splitter itself wrote; only fall back to the
    // computed style for the very first keypress, before any drag has happened.
    const inline = pane.style.getPropertyValue('--editor-h');
    const now = parseFloat(inline || getComputedStyle(pane).getPropertyValue('--editor-h')) || 34;
    apply(clamp(now + step));
  });
})();

/* Ctrl+Enter, Shift+Alt+F and Tab are bound inside src/scripts/editor.js, which
   is the only place that knows which editor is currently on screen - a listener
   on the textarea would stop working the moment CodeMirror replaced it. */

renderCollections();
renderSidebarDetail();

/**
 * `/practice/#top-customers-by-spend` opens that drill directly. Every lesson
 * and module page links in this way, so this is the seam between the static
 * pages and the app - if it silently no-ops, all of those links go nowhere.
 */
function openFromHash({ scroll = true } = {}) {
  const id = decodeURIComponent(location.hash.slice(1));
  const ex = id && EXERCISES.find((e) => e.id === id);
  if (!ex) return false;

  state.openId = ex.id;
  selectExercise(ex);
  renderExercises();
  if (scroll) {
    // The list is a scrolling pane, not the page, so scrollIntoView on the card
    // is the only thing that actually moves it. Optional call: it is cosmetic,
    // and it must never be the reason a deep link fails to open.
    $('exerciseList').querySelector('.ex.open')?.scrollIntoView?.({ block: 'center' });
  }
  return true;
}

/** The drill the list shows first: first track, first module in it, first drill. */
function firstDrill() {
  for (const track of TRACKS) {
    for (const module of MODULES.filter((m) => m.track === track.slug)) {
      const first = EXERCISES.find((e) => e.module === module.slug);
      if (first) return first;
    }
  }
  return null;
}

/**
 * A first visit opens a drill instead of presenting a menu.
 *
 * Three empty panes and a list of 38 cards asks a stranger to choose before they
 * know what any of it is. This opens the first drill - which is the easiest one,
 * because the course is ordered - and fills the field list with the collection
 * that drill is about, so two of the three panes say something on arrival.
 *
 * Only when there is genuinely nothing to preserve. Any progress, any saved
 * draft or any hash means this is not a first visit, and what the person left
 * behind beats anything this would do for them.
 */
function landInADrill() {
  if (Object.keys(state.progress).length || Object.keys(state.drafts).length) return false;

  const ex = firstDrill();
  if (!ex) return false;

  // The collection the drill is about, read off its own starter rather than
  // declared twice.
  const name = /\bdb\.([A-Za-z_]\w*)\s*\./.exec(ex.starter || ex.solution || '')?.[1];
  if (name && state.store[name]) {
    const li = [...$('collections').children].find((n) => n.firstChild?.textContent === name);
    selectCollection(name, li);    // sets the editor too, which the next line replaces
  }

  state.openId = ex.id;
  selectExercise(ex);
  renderExercises();
  return true;
}

if (!openFromHash()) {
  renderExercises();
  landInADrill();
}

// Someone editing the hash, or following a second link from an open tab.
window.addEventListener('hashchange', () => openFromHash());

// Drafts are otherwise only saved on Run, so leaving via the logo or Back would
// drop whatever was typed since. An untouched starter is not saved: a draft
// marks a returning visitor, and a first visit that only looked is not one.
window.addEventListener('pagehide', () => {
  const ex = state.current;
  if (!ex || editor.value === (state.drafts[ex.id] ?? ex.starter)) return;
  state.drafts[ex.id] = editor.value;
  save(LS_DRAFTS, state.drafts);
});
