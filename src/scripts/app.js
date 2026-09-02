// Practice app. Everything below runs in the tab: there is no server, no fetch,
// and nothing leaves the browser. The dataset is rebuilt from a seeded PRNG, so
// "reset data" is exact rather than approximate.

import { makeMingoDb } from '../../engine/mingo-db.js';
import { runCode } from '../../engine/run.js';
import { gradeExercise } from '../../engine/grade.js';
import ecommerce from '../../server/datasets/ecommerce.js';
import { EXERCISES } from '../../server/exercises/index.js';

const $ = (id) => document.getElementById(id);
const LS_PROGRESS = 'mp.progress';
const LS_DRAFTS = 'mp.drafts';

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
};

const state = {
  store: ecommerce.build(),
  db: null,
  current: null,
  openId: null,
  progress: load(LS_PROGRESS, {}),
  drafts: load(LS_DRAFTS, {}),
};
state.db = makeMingoDb(state.store);

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
  li.classList.add('active');
  setEditor(`db.${name}.find().limit(5)`);
  const doc = state.store[name]?.[0];
  $('sampleDoc').className = 'sample';
  $('sampleDoc').innerHTML = doc ? highlight(doc) : '<span class="muted">empty collection</span>';
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
  renderCollections(); // a write query changes the counts
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

  for (const batch of [1, 2, 3]) {
    const group = EXERCISES.filter((e) => e.batch === batch);
    if (!group.length) continue;

    const wrap = document.createElement('div');
    wrap.className = 'ex-batch';
    const heading = document.createElement('h3');
    heading.textContent = `Batch ${batch}`;
    wrap.appendChild(heading);
    for (const ex of group) wrap.appendChild(renderExercise(ex));
    host.appendChild(wrap);
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
  title.innerHTML =
    `<span class="id">${esc(ex.id)}</span>` +
    `<span>${esc(ex.title)}</span>` +
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

  const hint = document.createElement('button');
  hint.className = 'ghost';
  hint.textContent = 'Hint';
  hint.onclick = () => {
    if (body.querySelector('.ex-hint')) return;
    const el = document.createElement('div');
    el.className = 'ex-hint';
    el.innerHTML = markdownish(ex.hint || 'No hint for this one.');
    body.appendChild(el);
  };
  actions.appendChild(hint);

  const reveal = document.createElement('button');
  reveal.className = 'ghost';
  reveal.textContent = 'Show solution';
  reveal.onclick = () => revealSolution(ex, body);
  actions.appendChild(reveal);

  body.appendChild(actions);

  if (ex.noteRef) {
    const note = document.createElement('div');
    note.className = 'ex-note';
    note.textContent = `notes: ${ex.noteRef.file}:${ex.noteRef.line} — ${ex.noteRef.label}`;
    body.appendChild(note);
  }

  card.appendChild(body);
  return card;
}

function selectExercise(ex) {
  state.current = ex;
  setEditor(state.drafts[ex.id] ?? ex.starter);
  $('editorLabel').textContent = `${ex.id} · ${ex.title}`;
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

function revealSolution(ex, body) {
  if (body.querySelector('.ex-solution')) return;
  const ok = confirm(
    'Show the reference solution?\n\n' +
    'Try the Hint first — reading the answer now is what stops this from being practice.'
  );
  if (!ok) return;
  const el = document.createElement('div');
  el.className = 'ex-solution';
  el.textContent = ex.solution;
  body.appendChild(el);
}

/* ---------- wiring ---------- */

$('runBtn').onclick = run;

$('resetBtn').onclick = () => setEditor(state.current ? state.current.starter : '');

$('resetDataBtn').onclick = () => {
  state.store = ecommerce.build();
  state.db = makeMingoDb(state.store);
  renderCollections();
  $('sampleDoc').className = 'sample muted';
  $('sampleDoc').textContent = 'click a collection';
  toast('Dataset restored.');
};

$('editor').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    run();
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
renderExercises();
