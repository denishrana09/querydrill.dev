// Practice app. Everything below runs in the tab: there is no server, no fetch,
// and nothing leaves the browser. The dataset is rebuilt from a seeded PRNG, so
// "reset data" is exact rather than approximate.

import { makeMingoDb } from '../../engine/mingo-db.js';
import { runCode } from '../../engine/run.js';
import { gradeExercise } from '../../engine/grade.js';
import ecommerce from '../../server/datasets/ecommerce.js';
import { inferSchema } from './schema.js';
import { EXERCISES } from '../../server/exercises/index.js';
import { MODULES, TRACKS } from '../../content/curriculum.js';
import { migrateKeys } from '../../content/legacy-ids.js';

const $ = (id) => document.getElementById(id);
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
  // The engine reports the moment a query writes anything, which is the only
  // time offering to restore the data means something to the learner.
  state.db = makeMingoDb(state.store, 'practice', {
    onMutate: () => { state.dirty = true; },
  });
}
loadDataset();

/* ---------- chrome ---------- */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let toastTimer;
function toast(message, bad = false) {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* ---------- rendering results ---------- */

function highlight(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (value === null) return '<span class="b">null</span>';
  if (value === undefined) return '<span class="b">undefined</span>';
  if (typeof value === 'boolean') return `<span class="b">${value}</span>`;
  if (typeof value === 'number') return `<span class="num">${value}</span>`;
  if (typeof value === 'string') return `<span class="s">"${esc(value)}"</span>`;
  // Dates print shell-style, matching what the notes show.
  if (value instanceof Date) return `<span class="d">ISODate("${value.toISOString()}")</span>`;

  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map((v) => padIn + highlight(v, indent + 1)).join(',\n') + '\n' + pad + ']';
  }

  const keys = Object.keys(value);
  if (!keys.length) return '{}';
  const rows = keys.map(
    (k) => `${padIn}<span class="k">${esc(k)}</span>: ${highlight(value[k], indent + 1)}`
  );
  return '{\n' + rows.join(',\n') + '\n' + pad + '}';
}

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
    row.onclick = () => insertAtCursor(f.path);
    schema.appendChild(row);
  }
}

function insertAtCursor(text) {
  const el = $('editor');
  const { selectionStart: a, selectionEnd: b } = el;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  el.selectionStart = el.selectionEnd = a + text.length;
  el.focus();
}

/* ---------- editor ---------- */

function setEditor(text) {
  $('editor').value = text;
  $('editor').focus();
}

async function run() {
  const code = $('editor').value.trim();
  if (!code) return;

  if (state.current) {
    state.drafts[state.current.id] = $('editor').value;
    save(LS_DRAFTS, state.drafts);
  }

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
  const el = $('editor');
  const source = el.value.trim();
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
    el.value = out.trim();
    el.focus();
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
}

function renderExercises() {
  const host = $('exerciseList');
  host.innerHTML = '';

  // Modules, grouped under their track. The three 15-exercise "batches" were a
  // sitting nobody finishes; a module is four to six drills on one idea.
  for (const track of TRACKS) {
    const modules = MODULES.filter((m) => m.track === track.slug);
    if (!modules.length) continue;

    const trackHead = document.createElement('h3');
    trackHead.className = 'track-head';
    trackHead.textContent = track.title;
    host.appendChild(trackHead);

    for (const module of modules) {
      const group = EXERCISES.filter((e) => e.module === module.slug);
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
    renderExercises();
  };
  card.appendChild(title);
  if (!open) return card;

  const body = document.createElement('div');
  body.className = 'ex-body';

  const chips = document.createElement('div');
  chips.className = 'chips';
  chips.innerHTML =
    `<span class="chip ${ex.difficulty}">${ex.difficulty}</span>` +
    ex.topics.map((t) => `<span class="chip">${esc(t)}</span>`).join('');
  body.appendChild(chips);

  const prompt = document.createElement('div');
  prompt.className = 'ex-prompt';
  prompt.innerHTML = markdownish(ex.prompt);
  body.appendChild(prompt);

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
    { label: 'Show solution', run: () => revealSolution(ex, body) },
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

function selectExercise(ex) {
  state.current = ex;
  setEditor(state.drafts[ex.id] ?? ex.starter);
  const module = MODULES.find((m) => m.slug === ex.module);
  $('editorLabel').textContent = `${module ? module.title + ' · ' : ''}${ex.title}`;
}

async function checkAnswer(ex, body, button) {
  body.querySelectorAll('.ex-feedback').forEach((n) => n.remove());
  button.disabled = true;
  button.textContent = 'Checking…';

  const feedback = document.createElement('div');
  feedback.className = 'ex-feedback';

  const result = await gradeExercise(ecommerce, ex, $('editor').value);

  if (!result.ok) {
    const head = result.internal ? 'This exercise is broken — please report it:' : 'Your query errored:';
    feedback.innerHTML = `<span class="head">${head}</span><ul><li>${esc(result.error)}</li></ul>`;
    if (!result.internal) state.progress[ex.id] = 'fail';
  } else if (result.pass) {
    feedback.classList.add('pass');
    feedback.textContent = result.isWrite
      ? '✓ Correct. Grading used its own copy of the data, so your playground is untouched.'
      : '✓ Correct.';
    state.progress[ex.id] = 'pass';
  } else {
    feedback.innerHTML =
      '<span class="head">Not quite:</span><ul>' +
      result.diffs.map((d) => `<li>${esc(d)}</li>`).join('') +
      '</ul>';
    state.progress[ex.id] = 'fail';
  }

  body.appendChild(feedback);
  state.drafts[ex.id] = $('editor').value;
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

/** @returns false if the learner backed out, so the help ladder does not advance. */
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
$('copyQueryBtn').onclick = (e) => copyText($('editor').value, e.currentTarget);
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
      const top = $('editor').getBoundingClientRect().top;
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

$('editor').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    run();
    return;
  }
  if ((e.key === 'F' || e.key === 'f') && e.altKey && e.shiftKey) {
    e.preventDefault();
    formatQuery();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const el = e.target;
    const { selectionStart: a, selectionEnd: b } = el;
    el.value = el.value.slice(0, a) + '  ' + el.value.slice(b);
    el.selectionStart = el.selectionEnd = a + 2;
  }
});

renderCollections();
renderSidebarDetail();
renderExercises();
