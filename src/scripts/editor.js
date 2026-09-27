// The query editor, in one place.
//
// The <textarea> in the markup is not scaffolding to be thrown away: it is the
// editor until CodeMirror loads, and it stays the editor for good if CodeMirror
// never arrives. So both hosts implement one small surface, and the callers -
// src/scripts/app.js and src/scripts/runnable.js - never learn which one they
// have.
//
// Why upgrade rather than mount CodeMirror directly: the view, the JavaScript
// parser and the highlighter together weigh more than everything else on the
// page, and the one thing this editor does well today is that it is simply
// there. Loading it as a separate chunk after first paint keeps that, and a
// failed chunk load leaves a working editor instead of a dead box.
//
// Colours are deliberately not decided here. The `--syn-*` tokens the results
// pane already uses carry the syntax highlighting, so a string you type is the
// same orange as the string that comes back, both themes work with no extra
// code, and test/contrast.mjs has been checking those five values all along.
// Every box, font and padding lives in the stylesheets next to the rules it has
// to match. The only thing this file decides is which token each kind of token
// gets.

/* ---------- loading ---------- */

let chunk = null;

function load() {
  // Cached, and cleared on failure so a flaky network can be retried rather
  // than leaving the page with no way to ever get an upgrade.
  chunk ??= Promise.all([
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/language'),
    import('@codemirror/commands'),
    import('@codemirror/autocomplete'),
    import('@codemirror/lang-javascript'),
    import('@lezer/highlight'),
    // Imported here rather than at the top of this file on purpose. This module
    // is loaded on first paint - it is what decides whether the textarea gets
    // upgraded at all - so a static import would put 90 operators and their
    // descriptions in the bundle every visitor downloads, to be used only by
    // the editor that arrives later.
    import('../../content/operators.js'),
  ])
    .then(([state, view, language, commands, autocomplete, js, highlight, operators]) =>
      ({ state, view, language, commands, autocomplete, js, highlight, operators }))
    .catch((err) => {
      chunk = null;
      throw err;
    });
  return chunk;
}

/**
 * CodeMirror places the caret, wraps lines and decides what to scroll by
 * measuring the DOM. jsdom answers every measurement with zero, so mounting it
 * there gives an editor that renders and cannot be typed in - and
 * test/dom-smoke.mjs would then be driving that instead of the app. Asking
 * whether this environment lays anything out at all is the honest form of that
 * question, and it is why test/editor.mjs drives a real browser.
 */
function laysOut() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:8px;height:8px';
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().width;
  probe.remove();
  return measured > 0;
}

/* ---------- the two hosts ---------- */

function textareaHost(el) {
  return {
    get value() { return el.value; },
    set value(text) { el.value = text; },
    insert(text) {
      const { selectionStart: a, selectionEnd: b } = el;
      el.value = el.value.slice(0, a) + text + el.value.slice(b);
      el.selectionStart = el.selectionEnd = a + text.length;
    },
    focus() { el.focus(); },
    refresh() { /* a textarea has no cached geometry to be wrong about */ },
    get el() { return el; },
  };
}

function codeMirrorHost(view, { isolateHistory }) {
  return {
    get value() { return view.state.doc.toString(); },
    set value(text) {
      // Caret at the end, which is where setting a textarea's value leaves it -
      // so loading a starter, resetting and formatting all behave as they do
      // today. Neither end is where you actually want to type in a starter with
      // an empty slot in the middle of it; that is worth fixing for both hosts
      // at once, not quietly for one of them here.
      //
      // Going through a transaction rather than replacing the state is what
      // makes Format and reset undoable at all. Isolating it is what makes one
      // Ctrl+Z enough: without this, CodeMirror merges the rewrite into the same
      // undo event as the typing that preceded it, so the first undo after a
      // Format threw away the query as well as the formatting. Found by a test
      // asking for exactly what the comment here used to promise.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: text.length },
        annotations: isolateHistory.of('full'),
      });
    },
    insert(text) {
      view.dispatch(view.state.replaceSelection(text));
    },
    focus() { view.focus(); },
    // Everything CodeMirror knows about line heights and caret positions was
    // measured when it was last on screen. Mounted or unhidden inside a
    // display:none pane - which is what the mobile tab bar does to the editor -
    // those numbers are all zero, and it draws the caret in the wrong place
    // until something else forces a redraw.
    refresh() { view.requestMeasure(); },
    get el() { return view.dom; },
  };
}

/* ---------- syntax colours ---------- */

function highlightStyle({ language, highlight }) {
  const t = highlight.tags;
  return language.HighlightStyle.define([
    // Names of things - object keys and the methods you call - share one colour,
    // and it is the same blue the results pane gives a key. The distinction that
    // actually matters in a MongoDB query is `$group` the key against
    // "$items.product" the string, and that one is a colour apart.
    { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--syn-key)' },
    { tag: [t.function(t.propertyName), t.function(t.variableName)], color: 'var(--syn-key)' },
    { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
    { tag: t.number, color: 'var(--syn-number)' },
    { tag: [t.bool, t.null, t.keyword, t.atom], color: 'var(--syn-bool)' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--muted)', fontStyle: 'italic' },
    { tag: [t.punctuation, t.bracket, t.operator], color: 'var(--text-soft)' },
    { tag: t.variableName, color: 'var(--text)' },
    // A stray `}` or an unterminated string, marked before you press Run.
    { tag: t.invalid, color: 'var(--danger)' },
  ]);
}

/* ---------- completing $ operators ---------- */

/**
 * A `$` means two unrelated things in a MongoDB query, and which one is decided
 * entirely by whether you are inside a string.
 *
 *   { $group: { _id: "$items.product" } }
 *     ^ an operator            ^ a field path
 *
 * So the completions are suppressed inside strings and comments. Offering
 * `$group` while someone types `"$items` would be wrong every single time, and
 * an autocomplete that is confidently wrong is worse than none - people stop
 * reading it and it is still in the way.
 *
 * Field paths are the obvious other half of this and are deliberately not here:
 * they need the shape of the collection being queried, which this module has no
 * business knowing. See the roadmap.
 */
const NOT_AN_OPERATOR = new Set(['String', 'TemplateString', 'LineComment', 'BlockComment', 'Comment']);

/**
 * The help panel beside the list. A node rather than a string, so the backticks
 * these sentences are written with become `code` the way they do everywhere else
 * on the site - as a plain string CodeMirror prints the backticks.
 */
function infoNode(text) {
  const el = document.createElement('div');
  for (const part of text.split(/(`[^`]+`)/)) {
    if (!part) continue;
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      el.appendChild(code);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  }
  return el;
}

function operatorSource({ language, operators }) {
  // Built once, not per keystroke: the list never changes, and CodeMirror
  // filters and sorts it against what has been typed on its own.
  const options = operators.OPERATORS.map((o) => ({
    label: o.slug,
    type: 'keyword',
    detail: o.roles.join(' · '),
    info: () => infoNode(o.info),
  }));

  return (context) => {
    const word = context.matchBefore(/\$[a-zA-Z]*/);
    if (!word) return null;

    for (let node = language.syntaxTree(context.state).resolveInner(word.from, -1); node; node = node.parent) {
      if (NOT_AN_OPERATOR.has(node.name)) return null;
    }

    // `validFor` is what keeps it from re-running the source on every letter:
    // as long as what has been typed still looks like an operator, CodeMirror
    // narrows the list it already has.
    return { from: word.from, options, validFor: /^\$[a-zA-Z]*$/ };
  };
}

/* ---------- the upgrade ---------- */

async function upgrade(textarea, keys) {
  const mod = await load();
  const { EditorState } = mod.state;
  const { EditorView, keymap, placeholder } = mod.view;
  const { indentOnInput, indentUnit, bracketMatching, syntaxHighlighting } = mod.language;
  const { history, historyKeymap, defaultKeymap, indentWithTab, isolateHistory } = mod.commands;
  const { closeBrackets, closeBracketsKeymap, completionKeymap, autocompletion, currentCompletions } =
    mod.autocomplete;

  // Taken before the textarea goes away: someone can have started typing in the
  // half second this chunk took to arrive, and throwing that away would be the
  // worst possible moment to do it.
  const doc = textarea.value;
  const from = textarea.selectionStart ?? 0;
  const to = textarea.selectionEnd ?? from;
  const wasFocused = document.activeElement === textarea;

  const state = EditorState.create({
    doc,
    selection: { anchor: Math.min(from, doc.length), head: Math.min(to, doc.length) },
    extensions: [
      history(),
      // Ours first: whichever binding returns true wins, and defaultKeymap has
      // its own ideas about both Mod-Enter and Escape.
      keymap.of([
        { key: 'Mod-Enter', preventDefault: true, run: () => (keys.onRun?.(), true) },
        { key: 'Shift-Alt-f', preventDefault: true, run: () => (keys.onFormat?.(), true) },
        // Tab indents, as it did in the textarea. That makes the editor a focus
        // trap, which is the documented cost of indentWithTab - so Escape is the
        // way out for anyone not using a mouse.
        //
        // Unless the completion popup is open, in which case Escape means "close
        // that". Returning false hands the key to the completion keymap below,
        // so one Escape closes the popup and the next one leaves the editor.
        //
        // `currentCompletions`, not `completionStatus`. Status is "active" while
        // a source merely holds a result, which outlives the popup - and
        // CodeMirror's own Escape binding consumes the key on exactly that
        // condition. So once anyone had typed a `$`, Escape stopped leaving the
        // editor until it was pressed twice, with nothing on screen to explain
        // why. Found by the keyboard-trap check that has been here since the
        // editor landed, which is the only reason it was not shipped.
        {
          key: 'Escape',
          run: (v) => {
            if (currentCompletions(v.state).length) return false;
            v.contentDOM.blur();
            return true;
          },
        },
        indentWithTab,
        ...closeBracketsKeymap,
        // Before defaultKeymap, and that placement is the whole reason Enter
        // accepts a completion: this keymap is declared first, so it outranks
        // the one autocompletion() installs, and defaultKeymap's Enter would
        // otherwise insert a newline while the popup sat there. Every binding
        // in here is a no-op when no completion is open.
        ...completionKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      mod.js.javascript(),
      syntaxHighlighting(highlightStyle(mod)),
      bracketMatching(),
      closeBrackets(),
      // `override` rather than adding a source: the JavaScript language pack
      // offers completions from the surrounding scope, which in a five-line
      // query means the words you just typed. This editor completes operators
      // and nothing else, which is the version people can trust.
      autocompletion({
        override: [operatorSource(mod)],
        icons: false,
        maxRenderedOptions: 12,
        // Its own keymap is installed at the highest precedence, above anything
        // declared here - including the Escape above. Declined, and
        // completionKeymap is in the list above instead, where its order
        // relative to Escape and Enter is ours to decide.
        defaultKeymap: false,
      }),
      indentOnInput(),
      indentUnit.of('  '),
      // A pipeline stage runs past 360px long before it runs out of interest, and
      // sideways scrolling inside a code box on a phone is miserable.
      EditorView.lineWrapping,
      textarea.placeholder ? placeholder(textarea.placeholder) : [],
      // No line numbers and no active-line highlight: these queries are five
      // lines, the pane is 368px wide in a three-column layout, and a gutter
      // would spend a tenth of that on counting to five.
      // No drawSelection either - the browser's own selection and caret are
      // correct, themeable from CSS and one less thing to keep contrast-tested.
    ],
  });

  const view = new EditorView({ state });

  // The stylesheets style the editor through whatever classes the markup put on
  // the textarea, so they carry over and neither host needs its own geometry.
  // `cm-host` is added on top: the parts only CodeMirror has - brackets, its
  // caret, its placeholder - are coloured once in global.css rather than again
  // per host, because those are token choices and the geometry is not.
  for (const cls of textarea.classList) view.dom.classList.add(cls);
  view.dom.classList.add('cm-host');
  const label = textarea.getAttribute('aria-label');
  // contentDOM is the element that takes focus and carries role="textbox", so
  // that is where a label means anything.
  if (label) view.contentDOM.setAttribute('aria-label', label);

  textarea.parentNode.insertBefore(view.dom, textarea);
  textarea.remove();
  if (wasFocused) view.focus();

  // isolateHistory travels with the view, because the setter needs it and the
  // handle must not import a chunk it exists to keep out of the initial load.
  return { view, isolateHistory };
}

/* ---------- the handle ---------- */

/**
 * Replaces `textarea` with CodeMirror when it can, and hands back one object
 * that behaves the same either way.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {{ onRun?: () => void, onFormat?: () => void }} keys
 * @returns {{ value: string, insert: (t: string) => void, focus: () => void,
 *            el: HTMLElement, upgraded: boolean, ready: Promise<boolean> }}
 */
export function attachEditor(textarea, keys = {}) {
  let host = textareaHost(textarea);
  let upgraded = false;

  // The same two shortcuts, plus Tab, while the textarea is still the editor.
  // Without this the first moments of every visit have no Ctrl+Enter, which is
  // the shortcut the Run button advertises.
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      keys.onRun?.();
    } else if ((e.key === 'F' || e.key === 'f') && e.altKey && e.shiftKey) {
      e.preventDefault();
      keys.onFormat?.();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      host.insert('  ');
    }
  });

  const ready = !laysOut()
    ? Promise.resolve(false)
    : upgrade(textarea, keys).then(
      (built) => {
        host = codeMirrorHost(built.view, built);
        upgraded = true;
        return true;
      },
      (err) => {
        // Loud, because the alternative is shipping a site where the editor
        // silently never upgrades and the tests all pass. test/editor.mjs fails
        // if this happens in a real browser.
        console.warn('editor: CodeMirror did not load, staying with the textarea', err);
        return false;
      },
    );

  return {
    get value() { return host.value; },
    set value(text) { host.value = text; },
    insert: (text) => host.insert(text),
    focus: () => host.focus(),
    refresh: () => host.refresh(),
    get el() { return host.el; },
    get upgraded() { return upgraded; },
    ready,
  };
}
