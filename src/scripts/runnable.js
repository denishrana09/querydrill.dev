// Makes the example queries on a reading page runnable.
//
// The markdown pipeline tags a fenced block with `data-runnable` when it is a
// complete query - see engine/runnable.js for the rule. Every control below is
// built at runtime rather than written into the markup, so a page with this
// script blocked, or simply not loaded yet, is exactly the static code block it
// always was. Nothing to re-flow, nothing to hide.
//
// Weight matters more here than in the practice app: a lesson is a reading page
// that happens to be runnable, not an app. So this file stays a stub, and mingo,
// the dataset and the query engine sit behind a dynamic import that does not
// fire until someone actually presses Run. The editor is behind the same kind of
// door, on the Edit click: src/scripts/editor.js is 2.4 KB gzipped and
// CodeMirror behind it is 167 KB, and neither is any use to a reader who is
// reading. Importing the facade up here instead measured at 1.7 KB -> 4.1 KB on
// every reading page, for a click most visits never make.

const BLOCKS = document.querySelectorAll('pre[data-runnable]');

// A lesson is prose with an example in it, not a results pane. Twenty documents
// is enough to see the shape of an answer; two hundred would push the rest of
// the lesson off the screen.
const ROWS = 20;

/* ---------- the engine, loaded on demand ---------- */

let enginePromise = null;

function engine() {
  // Cached, and cleared on failure so a flaky network can be retried instead of
  // poisoning every Run button on the page for good.
  enginePromise ??= Promise.all([
    import('../../engine/mingo-db.js'),
    import('../../engine/run.js'),
    import('../../engine/format.js'),
    import('../../server/datasets/ecommerce.js'),
  ])
    .then(([db, run, fmt, data]) => ({
      makeMingoDb: db.makeMingoDb,
      runCode: run.runCode,
      highlight: fmt.highlight,
      dataset: data.default,
    }))
    .catch((err) => {
      enginePromise = null;
      throw err;
    });
  return enginePromise;
}

/* ---------- one dataset per page, shared by every block ---------- */

// Deliberately shared. A lesson on `$set` writes, and the find below it should
// show the write - that is the truth about a database, and rebuilding per block
// would teach that updates do nothing.
let data = null;

function freshData(mod) {
  const next = { dirty: false };
  next.db = mod.makeMingoDb(mod.dataset.build(), 'practice', {
    onMutate: () => { next.dirty = true; },
  });
  return next;
}

/* ---------- small DOM helpers ---------- */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const button = (label, className, title) => {
  const b = el('button', className, label);
  b.type = 'button';
  if (title) b.title = title;
  return b;
};

/* ---------- per-block wiring ---------- */

function enhance(pre, index) {
  // Shiki keeps the source verbatim in the text nodes, so the block itself is
  // the only copy of the code. Repeating it in a data attribute would put every
  // example on the page twice in the HTML for nothing.
  const original = pre.textContent.replace(/\n+$/, '');
  let editor = null;

  const box = el('div', 'rx');
  pre.replaceWith(box);

  const bar = el('div', 'rx-bar');
  const runBtn = button('Run', 'rx-btn rx-primary', 'Run this query - Ctrl+Enter');
  const editBtn = button('Edit', 'rx-btn', 'Change the query and run it again');
  const copyBtn = button('Copy', 'rx-btn', 'Copy the query');
  bar.append(runBtn, editBtn, copyBtn);

  // Said once per page, on the first example, so the reader knows what the query
  // is running against before they wonder where the data came from.
  if (index === 0) {
    const note = el('span', 'rx-note');
    const link = el('a', null, 'sample dataset');
    link.href = '/dataset/';
    note.append(document.createTextNode('runs in your browser on the '), link);
    bar.append(note);
  }

  const out = el('div', 'rx-out');
  out.hidden = true;
  const meta = el('div', 'rx-meta');
  // The result replaces itself on every run, so a screen reader needs telling.
  meta.setAttribute('aria-live', 'polite');
  const body = el('pre', 'rx-body json-view');
  out.append(meta, body);

  box.append(bar, pre, out);

  const editing = () => Boolean(editor) && !editor.el.hidden;
  const code = () => (editing() ? editor.value : original);

  /* -- edit mode -- */

  /**
   * A textarea has to be told how tall its own content is. CodeMirror grows on
   * its own, so once the swap has happened this has nothing left to do - and
   * the inline height leaves with the element it was written on.
   */
  function fit() {
    const node = editor?.el;
    if (!node || node.tagName !== 'TEXTAREA') return;
    node.style.height = 'auto';
    node.style.height = node.scrollHeight + 'px';
  }

  /** Kept as the promise, so two fast clicks on Edit cannot build two editors. */
  let building = null;

  function ensureEditor() {
    building ??= import('./editor.js').then(({ attachEditor }) => {
      const area = el('textarea', 'rx-editor');
      area.spellcheck = false;
      area.setAttribute('aria-label', 'Query');
      area.addEventListener('input', fit);
      pre.after(area);
      // Ctrl+Enter is bound in there rather than here, because the element it
      // has to be bound to is about to be replaced by CodeMirror.
      editor = attachEditor(area, { onRun: run });
      // Only matters if CodeMirror never arrives: the textarea is then still the
      // editor, and still the thing that has to be told how tall it is.
      editor.ready.then(fit);
      return editor;
    });
    return building;
  }

  async function edit() {
    // Read the code before the editor exists. A fresh textarea is not hidden,
    // so asking code() after creating it returns the empty new element instead of
    // the block - which emptied the editor on the very first Edit click.
    const from = code();

    const ed = await ensureEditor();
    ed.value = from;
    ed.el.hidden = false;
    pre.hidden = true;
    // Only measurable once the element is laid out, so this has to follow the
    // unhide - and CodeMirror has the same problem with a different answer.
    fit();
    ed.refresh();
    ed.focus();
    editBtn.textContent = 'Reset';
    editBtn.title = 'Put the original query back';
  }

  function reset() {
    if (editor) editor.el.hidden = true;
    pre.hidden = false;
    editBtn.textContent = 'Edit';
    editBtn.title = 'Change the query and run it again';
    out.hidden = true;
  }

  /* -- running -- */

  function restoreControl() {
    const b = button('restore it', 'rx-linkish');
    b.addEventListener('click', async () => {
      data = freshData(await engine());
      meta.textContent = 'sample data restored';
    });
    return b;
  }

  async function run() {
    runBtn.disabled = true;
    out.hidden = false;
    meta.textContent = 'running…';
    body.textContent = '';

    let mod;
    try {
      mod = await engine();
    } catch {
      // A failed chunk load is about the network, not the query, and the block is
      // still perfectly readable - so say which of the two actually went wrong.
      meta.textContent = 'the query engine could not load - check your connection and try again';
      runBtn.disabled = false;
      return;
    }

    data ??= freshData(mod);
    const res = await mod.runCode(data.db, code(), { cap: ROWS });

    meta.textContent = '';
    if (!res.ok) {
      meta.append(el('span', 'rx-err', 'error'), document.createTextNode(` · ${res.ms}ms`));
      body.textContent = res.error;
      runBtn.disabled = false;
      return;
    }

    const bits = [`${res.ms}ms`];
    if (res.totalRows != null) {
      bits.push(`${res.totalRows} document${res.totalRows === 1 ? '' : 's'}`);
    }
    if (res.truncated) bits.push(`showing ${ROWS}`);
    if (res.isUndefined) bits.push('no value returned - multi-statement code needs an explicit return');
    meta.append(el('span', 'rx-ok', 'ok'), document.createTextNode(' · ' + bits.join(' · ')));

    // One dataset per page means a write in an earlier block is still there in a
    // later one, so the offer to undo it belongs wherever the reader is looking.
    if (data.dirty) {
      meta.append(
        document.createTextNode(' · '),
        el('span', 'rx-warn', 'data changed on this page'),
        document.createTextNode(' · '),
        restoreControl()
      );
    }

    body.innerHTML = mod.highlight(res.value);
    runBtn.disabled = false;
  }

  runBtn.addEventListener('click', run);

  copyBtn.addEventListener('click', async () => {
    const was = copyBtn.textContent;
    try {
      await navigator.clipboard.writeText(code());
      copyBtn.textContent = 'Copied';
    } catch {
      copyBtn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { copyBtn.textContent = was; }, 1400);
  });

  editBtn.addEventListener('click', () => (editing() ? reset() : edit()));
}

BLOCKS.forEach(enhance);
