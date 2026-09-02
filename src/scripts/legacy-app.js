'use strict';

const $ = (id) => document.getElementById(id);
const LS_DB = 'mp.db';
const LS_PROGRESS = 'mp.progress';

const state = {
  db: localStorage.getItem(LS_DB) || '',
  exercises: [],
  current: null,          // active exercise object, or null for free play
  progress: load(LS_PROGRESS, {}),
  openId: null,
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveProgress() {
  localStorage.setItem(LS_PROGRESS, JSON.stringify(state.progress));
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    method: options?.body ? 'POST' : 'GET',
  });
  const data = await res.json().catch(() => ({ error: 'Bad response from server.' }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let toastTimer;
function toast(message, bad = false) {
  const el = $('toast');
  el.textContent = message;
  el.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

/* ---------- rendering EJSON ---------- */

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Turn relaxed EJSON back into shell-ish notation, so what you see matches
// what the study notes show.
function humanise(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(humanise);
  const keys = Object.keys(value);
  if (keys.length === 1) {
    if (keys[0] === '$oid') return { __raw: `ObjectId("${value.$oid}")` };
    if (keys[0] === '$date') return { __raw: `ISODate("${value.$date}")` };
    if (keys[0] === '$numberDecimal') return { __raw: `NumberDecimal("${value.$numberDecimal}")` };
    if (keys[0] === '$numberLong') return { __raw: `NumberLong("${value.$numberLong}")` };
    if (keys[0] === '$numberInt') return { __raw: value.$numberInt };
    if (keys[0] === '$numberDouble') return { __raw: value.$numberDouble };
    if (keys[0] === '$timestamp') {
      return { __raw: `Timestamp(${value.$timestamp.t}, ${value.$timestamp.i})` };
    }
    if (keys[0] === '$binary') return { __raw: `BinData(${value.$binary.subType}, "...")` };
    if (keys[0] === '$regularExpression') {
      const { pattern, options } = value.$regularExpression;
      return { __raw: `/${pattern}/${options || ''}` };
    }
    if (keys[0] === '$minKey') return { __raw: 'MinKey' };
    if (keys[0] === '$maxKey') return { __raw: 'MaxKey' };
  }
  const out = {};
  for (const k of keys) out[k] = humanise(value[k]);
  return out;
}

function highlight(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (value === null) return '<span class="b">null</span>';
  if (value === undefined) return '<span class="b">undefined</span>';
  if (typeof value === 'boolean') return `<span class="b">${value}</span>`;
  if (typeof value === 'number') return `<span class="num">${value}</span>`;
  if (typeof value === 'string') return `<span class="s">"${esc(value)}"</span>`;

  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const rows = value.map((v) => padIn + highlight(v, indent + 1));
    return '[\n' + rows.join(',\n') + '\n' + pad + ']';
  }

  if (value.__raw !== undefined) return `<span class="d">${esc(value.__raw)}</span>`;

  const keys = Object.keys(value);
  if (!keys.length) return '{}';
  const rows = keys.map((k) => `${padIn}<span class="k">${esc(k)}</span>: ${highlight(value[k], indent + 1)}`);
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

  const bits = [`<span class="ok">ok</span>`, `${payload.ms}ms`];
  if (payload.totalRows !== null && payload.totalRows !== undefined) {
    bits.push(`${payload.totalRows} row${payload.totalRows === 1 ? '' : 's'}`);
  }
  if (payload.truncated) bits.push(`showing first 200`);
  if (payload.isUndefined) bits.push('no value returned - add a `return` for multi-statement code');
  meta.innerHTML = bits.join(' · ');

  let parsed;
  try { parsed = JSON.parse(payload.ejson); } catch { parsed = null; }
  const logLines = payload.logs.length ? payload.logs.join('\n') + '\n\n' : '';
  body.innerHTML = esc(logLines) + highlight(humanise(parsed));
}

/* ---------- database / dataset header ---------- */

async function refreshStatus() {
  const el = $('status');
  try {
    const info = await api('/api/status');
    el.className = 'status ok';
    el.querySelector('span').textContent = `MongoDB ${info.version}`;
  } catch (err) {
    el.className = 'status bad';
    el.querySelector('span').textContent = err.message;
  }
}

async function refreshDatabases(preferred) {
  const { databases } = await api('/api/databases');
  const select = $('dbSelect');
  const want = preferred || state.db;

  select.innerHTML = '';
  for (const d of databases) {
    const opt = document.createElement('option');
    opt.value = d.name;
    opt.textContent = d.reserved ? `${d.name} (reserved)` : d.name;
    opt.disabled = d.reserved;
    select.appendChild(opt);
  }
  // A database typed via "+ new" does not exist until it is seeded.
  if (want && !databases.some((d) => d.name === want)) {
    const opt = document.createElement('option');
    opt.value = want;
    opt.textContent = `${want} (not created yet)`;
    select.appendChild(opt);
  }
  if (want) select.value = want;
  state.db = select.value;
  localStorage.setItem(LS_DB, state.db);
}

async function refreshDatasets() {
  const { datasets } = await api('/api/datasets');
  const select = $('datasetSelect');
  select.innerHTML = '';
  for (const d of datasets) {
    const opt = document.createElement('option');
    opt.value = d.key;
    opt.textContent = d.label;
    opt.title = d.description;
    select.appendChild(opt);
  }
  select.value = 'ecommerce';
}

async function refreshCollections() {
  const list = $('collections');
  if (!state.db) {
    list.innerHTML = '<li class="muted">pick a database</li>';
    return;
  }
  try {
    const { collections } = await api(`/api/collections?db=${encodeURIComponent(state.db)}`);
    if (!collections.length) {
      list.innerHTML = '<li class="muted">empty - hit Seed</li>';
      return;
    }
    list.innerHTML = '';
    for (const c of collections) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${esc(c.name)}</span><span class="n">${c.count}</span>`;
      li.onclick = () => selectCollection(c.name, li);
      list.appendChild(li);
    }
  } catch (err) {
    list.innerHTML = `<li class="muted">${esc(err.message)}</li>`;
  }
}

async function selectCollection(name, li) {
  document.querySelectorAll('.collections li').forEach((n) => n.classList.remove('active'));
  li.classList.add('active');
  setEditor(`db.${name}.find().limit(5)`);
  try {
    const { ejson } = await api(`/api/sample?db=${encodeURIComponent(state.db)}&collection=${encodeURIComponent(name)}`);
    const doc = ejson ? JSON.parse(ejson) : null;
    $('sampleDoc').className = 'sample';
    $('sampleDoc').innerHTML = doc ? highlight(humanise(doc)) : '<span class="muted">empty collection</span>';
  } catch (err) {
    $('sampleDoc').textContent = err.message;
  }
}

async function seed() {
  const dataset = $('datasetSelect').value;
  if (!state.db) return toast('Pick or create a database first.', true);

  const btn = $('seedBtn');
  btn.disabled = true;
  btn.textContent = 'Seeding…';
  try {
    const result = await api('/api/seed', { body: { db: state.db, dataset } });
    const summary = Object.entries(result.counts).map(([k, v]) => `${k} ${v}`).join(', ');
    toast(`Seeded ${dataset} into ${result.db}: ${summary}`);
    await refreshDatabases(state.db);
    await refreshCollections();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Seed';
  }
}

/* ---------- editor ---------- */

function setEditor(text) {
  $('editor').value = text;
  $('editor').focus();
}

async function run() {
  if (!state.db) return toast('Pick a database first.', true);
  const code = $('editor').value.trim();
  if (!code) return;

  const wrapped = $('explainToggle').checked ? explainWrap(code) : code;

  $('resultMeta').textContent = 'running…';
  try {
    const payload = await api('/api/run', { body: { db: state.db, code: wrapped } });
    renderResult(payload);
  } catch (err) {
    renderResult({ ok: false, error: err.message, ms: 0, logs: [] });
  }
}

// Append .explain() unless the snippet already asks for one. Only find() and
// aggregate() return an explainable cursor - anything else would fail with a
// confusing "explain is not a function".
function explainWrap(code) {
  if (/\.explain\s*\(/.test(code)) return code;
  if (!/\.(find|aggregate)\s*\(/.test(code)) {
    toast('explain only applies to find() and aggregate() - ran it plain.');
    return code;
  }
  return `(${code}).explain("executionStats")`;
}

/* ---------- exercises ---------- */

function markdownish(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
}

async function loadExercises() {
  const { exercises } = await api('/api/exercises');
  state.exercises = exercises;
  renderExercises();
}

function renderProgress() {
  const done = state.exercises.filter((e) => state.progress[e.id] === 'pass').length;
  $('progress').textContent = `${done}/${state.exercises.length} passed`;
}

function renderExercises() {
  const host = $('exerciseList');
  host.innerHTML = '';

  for (const batch of [1, 2, 3]) {
    const group = state.exercises.filter((e) => e.batch === batch);
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
  setEditor(ex.starter);
  $('editorLabel').textContent = `${ex.id} · ${ex.title}`;
}

async function checkAnswer(ex, body, button) {
  if (!state.db) return toast('Pick a database first.', true);

  body.querySelectorAll('.ex-feedback').forEach((n) => n.remove());
  button.disabled = true;
  button.textContent = 'Checking…';

  const feedback = document.createElement('div');
  feedback.className = 'ex-feedback';

  try {
    const result = await api('/api/check', {
      body: { db: state.db, id: ex.id, code: $('editor').value },
    });

    if (!result.ok) {
      feedback.innerHTML = `<span class="head">Your query errored:</span><ul><li>${esc(result.error)}</li></ul>`;
      state.progress[ex.id] = 'fail';
    } else if (result.pass) {
      feedback.classList.add('pass');
      feedback.textContent = ex.type === 'write'
        ? '✓ Correct. The data was restored afterwards, so you can run it again.'
        : '✓ Correct.';
      state.progress[ex.id] = 'pass';
    } else {
      feedback.innerHTML =
        '<span class="head">Not quite:</span><ul>' +
        result.diffs.map((d) => `<li>${esc(d)}</li>`).join('') +
        '</ul>';
      state.progress[ex.id] = 'fail';
    }
  } catch (err) {
    feedback.innerHTML = `<span class="head">Could not check:</span><ul><li>${esc(err.message)}</li></ul>`;
  }

  body.appendChild(feedback);
  saveProgress();
  renderProgress();

  // Repaint the card border/tick without collapsing the open card.
  const card = body.parentElement;
  const status = state.progress[ex.id] || '';
  card.className = ('ex open ' + status).trim();
  const mark = card.querySelector('.mark');
  mark.className = ('mark ' + status).trim();
  mark.textContent = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '';

  button.disabled = false;
  button.textContent = 'Check';
}

async function revealSolution(ex, body) {
  if (body.querySelector('.ex-solution')) return;
  const ok = confirm(
    'Show the reference solution?\n\n' +
    'Try the Hint first - reading the answer now is what stops this from being practice.'
  );
  if (!ok) return;

  try {
    const { solution } = await api('/api/solution', { body: { id: ex.id } });
    const el = document.createElement('div');
    el.className = 'ex-solution';
    el.textContent = solution;
    body.appendChild(el);
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------- wiring ---------- */

$('runBtn').onclick = run;
$('seedBtn').onclick = seed;

$('resetBtn').onclick = () => {
  if (state.current) setEditor(state.current.starter);
  else { setEditor(''); }
};

$('dbSelect').onchange = async (e) => {
  state.db = e.target.value;
  localStorage.setItem(LS_DB, state.db);
  await refreshCollections();
};

$('newDbBtn').onclick = async () => {
  const name = prompt('New database name:', 'practice');
  if (!name) return;
  await refreshDatabases(name.trim());
  await refreshCollections();
  toast(`"${name.trim()}" selected. Hit Seed to create it.`);
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

(async function init() {
  await refreshStatus();
  try {
    await refreshDatasets();
    await refreshDatabases();
    await refreshCollections();
    await loadExercises();
  } catch (err) {
    toast(err.message, true);
  }
})();
