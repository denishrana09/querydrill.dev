// Drives the real editor in a real browser.
//
// This is the test that matters for CodeMirror, and it exists because the one
// that runs everywhere cannot do this job: jsdom answers every measurement with
// zero, so src/scripts/editor.js declines to mount CodeMirror there and
// test/dom-smoke.mjs drives the textarea fallback instead. That fallback is a
// real shipped path - it is what a failed chunk load leaves behind - but it is
// not the one almost everybody gets. Without this file, "the editor silently
// never upgrades" is a bug that passes every other suite.
//
// So everything below is asked of Chrome, against `dist/`, through the keyboard:
// typed characters rather than assignments to a value, because auto-closing
// brackets and auto-indent only exist in response to real input events.
//
//   npm run build && node test/editor.mjs

import process from 'node:process';
import { openChrome, findBrowser, until, GREEN, RED, DIM, OFF } from './chrome.mjs';

const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ${GREEN}ok${OFF}    ${label}`);
  else {
    failures.push(label);
    console.log(`  ${RED}FAIL${OFF}  ${label}${detail ? `\n        ${detail}` : ''}`);
  }
};

if (!findBrowser()) {
  console.log(`  ${DIM}skipped${OFF}  no Chrome or Edge found - set CHROME=/path/to/chrome to run this`);
  process.exit(0);
}

// Wide enough for the three-column layout, which is the one the editor has to
// share its width with. 360px is test/mobile.mjs's job.
const { send, evaluate, base } = await openChrome({
  previewPort: 4332,
  cdpPort: 9334,
  profile: 'mp-editor-check',
  width: 1280,
  height: 900,
});

/* ---------- typing, for real ---------- */

const CTRL = 2;

const NAMED = {
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  a: { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 },
  z: { key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 },
};

async function press(name, modifiers = 0) {
  const spec = { ...NAMED[name] };
  // A Ctrl combination produces no character. Leaving `text` on turns Ctrl+Enter
  // into a newline, and then the test for Ctrl+Enter passes by accident.
  if (modifiers) delete spec.text;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers, ...spec });
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', modifiers, key: spec.key, code: spec.code,
    windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
  });
}

async function type(text) {
  for (const ch of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
}

const focusEditor = (sel = '.cm-content') =>
  evaluate(`JSON.stringify(Boolean(document.querySelector('${sel}')?.focus() ?? true))`);

const doc = (sel = '.cm-content') =>
  evaluate(`JSON.stringify(document.querySelector('${sel}').innerText.replace(/\\u00a0/g, ' '))`);

async function clearAndType(text) {
  await focusEditor();
  await press('a', CTRL);
  await press('Backspace');
  await type(text);
}

/* ---------- 1. it actually mounts ---------- */

await send('Page.navigate', { url: base + '/practice/' });
const mounted = await until(evaluate, `document.querySelector('.cm-content')`);
check('CodeMirror replaces the textarea on the practice page', mounted,
  'the upgrade never happened - the site is shipping the fallback');
if (!mounted) { console.log(''); process.exit(1); }

const shell = await evaluate(`(() => JSON.stringify({
  textareaLeft: Boolean(document.getElementById('editor')),
  onTheRoot: [...document.querySelector('.cm-editor').classList].sort(),
  editable: document.querySelector('.cm-content').getAttribute('contenteditable'),
  labelled: document.querySelector('.cm-content').getAttribute('aria-label'),
  font: getComputedStyle(document.querySelector('.cm-scroller')).fontFamily,
  size: getComputedStyle(document.querySelector('.cm-scroller')).fontSize,
}))()`);

check('the textarea is gone rather than left hidden behind it', !shell.textareaLeft);
check('the host class carried over, so the pane geometry still applies',
  shell.onTheRoot.includes('query-box') && shell.onTheRoot.includes('cm-host'),
  shell.onTheRoot.join(' '));
check('the editable surface is labelled for a screen reader',
  shell.editable === 'true' && shell.labelled === 'Query editor',
  `contenteditable=${shell.editable} aria-label=${shell.labelled}`);
// CodeMirror's base theme puts a bare `monospace` on the scroller, which wins
// over anything inherited. If that leaks through, every query on the site is
// suddenly in a different typeface from every code block around it.
check('it uses the site mono font at the textarea size, not the base theme default',
  /Cascadia|ui-monospace|Consolas/.test(shell.font) && shell.size === '13px',
  `${shell.font} / ${shell.size}`);

/* ---------- 2. syntax colours come from the token set ---------- */

const QUERY = 'db.orders.find({ status: "completed" }, { rating: 4 })';
await clearAndType(QUERY);

// Typed rather than assigned, and the closers were typed too - so if the
// auto-inserted ones failed to be typed over, every bracket and quote here would
// appear twice. (It does not prove auto-closing happens at all; removing
// closeBrackets leaves this passing and fails the indent check below. Worth
// knowing which check is load-bearing for what.)
check('typing a query with brackets and quotes leaves exactly what was typed',
  (await doc()) === QUERY, JSON.stringify(await doc()));

const PALETTE = `(() => {
  const root = getComputedStyle(document.documentElement);
  const rgb = (h) => {
    const s = h.trim().replace('#', '');
    const f = s.length === 3 ? [...s].map((c) => c + c).join('') : s;
    return 'rgb(' + [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)).join(', ') + ')';
  };
  const spans = [...document.querySelectorAll('.cm-content span')];
  const colourOf = (text) => {
    const hit = spans.find((s) => s.textContent === text);
    return hit ? getComputedStyle(hit).color : null;
  };
  return JSON.stringify({
    want: {
      key: rgb(root.getPropertyValue('--syn-key')),
      string: rgb(root.getPropertyValue('--syn-string')),
      number: rgb(root.getPropertyValue('--syn-number')),
    },
    got: { key: colourOf('status'), string: colourOf('"completed"'), number: colourOf('4') },
    texts: spans.map((s) => s.textContent),
  });
})()`;

const dark = await evaluate(PALETTE);
check('an object key is the same blue the results pane gives a key',
  dark.got.key === dark.want.key, `${dark.got.key} vs ${dark.want.key} — spans: ${dark.texts.join('|')}`);
// The distinction that matters most here: "$items.product" is a string and
// $group is a key, and confusing the two is a mistake people actually make.
check('a string literal is the string colour, and not the key colour',
  dark.got.string === dark.want.string && dark.got.string !== dark.got.key,
  `${dark.got.string} vs ${dark.want.string}`);
check('a number is the number colour', dark.got.number === dark.want.number,
  `${dark.got.number} vs ${dark.want.number}`);

/* ---------- 3. and therefore follow the theme ---------- */

// The whole reason the colours are `var(--syn-*)` and not values baked into a
// CodeMirror theme object. If this fails, the editor is a dark box on a white
// page for everyone using the light theme.
await evaluate(`JSON.stringify(Boolean(document.querySelector('[data-theme-toggle]').click() ?? true))`);
await new Promise((r) => setTimeout(r, 120));
const light = await evaluate(PALETTE);
check('switching theme re-colours the code, because the colours are tokens',
  light.got.string === light.want.string && light.got.string !== dark.got.string,
  `dark ${dark.got.string} -> light ${light.got.string}, token says ${light.want.string}`);
await evaluate(`JSON.stringify(Boolean(document.querySelector('[data-theme-toggle]').click() ?? true))`);

/* ---------- 4. brackets ---------- */

// The caret is sitting just after the final ) of the query typed above, so the
// pair should be marked without touching anything else.
const brackets = await evaluate(`(() => {
  const marked = [...document.querySelectorAll('.cm-matchingBracket')];
  return JSON.stringify({
    count: marked.length,
    texts: marked.map((m) => m.textContent),
    painted: marked[0] ? getComputedStyle(marked[0]).backgroundColor : null,
    panel2: getComputedStyle(document.documentElement).getPropertyValue('--panel-2').trim(),
  });
})()`);
check('the bracket under the caret is marked together with its partner',
  brackets.count === 2 && brackets.texts.join('') === '()', JSON.stringify(brackets));
check('and the marking is visible rather than transparent',
  brackets.painted && brackets.painted !== 'rgba(0, 0, 0, 0)', String(brackets.painted));

/* ---------- 5. auto-indent ---------- */

await clearAndType('db.orders.aggregate([');
await press('Enter');
const indented = (await doc()).split('\n');
check('Enter inside a bracket pair indents, and the closers were added for you',
  indented[0] === 'db.orders.aggregate([' && indented[1] === '  ' && indented[2] === '])',
  JSON.stringify(indented));

/* ---------- 6. Ctrl+Enter runs what is in CodeMirror ---------- */

await clearAndType('db.users.find().limit(2)');
await press('Enter', CTRL);
const ran = await until(evaluate,
  `!document.getElementById('resultMeta').textContent.includes('results appear here')
   && document.getElementById('resultBody').textContent.length > 20`);
const meta = await evaluate(`JSON.stringify(document.getElementById('resultMeta').textContent)`);
check('Ctrl+Enter runs the query CodeMirror is holding', ran, meta);
// Two rows and not thirty: proof the run used the document CodeMirror is holding
// and not some stale copy of what the editor used to contain.
check('and the run reports the row count the limited query found',
  /\b2 rows\b/.test(meta), meta);

/* ---------- 7. Format reads and writes CodeMirror, undoably ---------- */

const SQUASHED = 'db.users.find({status:"active"},{_id:0,name:1})';
await clearAndType(SQUASHED);
await evaluate(`JSON.stringify(Boolean(document.getElementById('formatBtn').click() ?? true))`);
// Prettier is a 168 KB chunk that only loads on this click, so this waits rather
// than assuming.
await until(evaluate, `document.querySelector('.cm-content').innerText !== ${JSON.stringify(SQUASHED)}`);
const formatted = await doc();
check('Format rewrites the document CodeMirror is holding',
  formatted.includes('status: "active"') && formatted !== SQUASHED, JSON.stringify(formatted));

await focusEditor();
await press('z', CTRL);
check('and a single undo gives back exactly what was typed',
  (await doc()) === SQUASHED, JSON.stringify(await doc()));

/* ---------- 8. the schema sidebar still inserts into the editor ---------- */

const inserted = await evaluate(`(() => {
  document.getElementById('collections').children[0].click();
  const row = [...document.querySelectorAll('#schema .row')].find((r) => r.title.includes('.'));
  const path = row.title.split(' ')[0];
  row.click();
  return JSON.stringify({ path, doc: document.querySelector('.cm-content').innerText });
})()`);
check('clicking a field in the sidebar inserts its dotted path into CodeMirror',
  inserted.doc.includes(inserted.path), `${inserted.path} not in ${JSON.stringify(inserted.doc)}`);

/* ---------- 9. a deep link still lands its starter in the editor ---------- */

// The seam between the 74 static pages and the app: every lesson and module page
// links to a drill this way. It is covered in jsdom, but in jsdom the editor is
// the textarea - so nothing until now proved the starter reaches CodeMirror.
await send('Page.navigate', { url: base + '/practice/#count-by-group' });
await until(evaluate, `document.querySelector('.cm-content')`);
const deep = await evaluate(`(() => JSON.stringify({
  code: document.querySelector('.cm-content').innerText.replace(/\\u00a0/g, ' '),
  label: document.getElementById('editorLabel').textContent,
}))()`);
check('a deep link loads the drill starter into CodeMirror',
  deep.code.startsWith('db.orders.aggregate(['), JSON.stringify(deep.code));
check('and the editor says which drill it is holding',
  deep.label.includes('Count by group'), deep.label);

/* ---------- 10. completing $ operators ---------- */

// The whole feature is about *when* it offers something, so most of these are
// about it staying quiet. jsdom cannot host any of it: without layout there is
// no CodeMirror, and without real key events there is no completion at all.

const popup = () => evaluate(`JSON.stringify((() => {
  const box = document.querySelector('.cm-tooltip-autocomplete');
  // getBoundingClientRect, not offsetParent: CodeMirror gives this tooltip
  // position fixed, and a fixed element has no offsetParent even on screen.
  if (!box || box.getBoundingClientRect().height === 0) return null;
  const rows = [...box.querySelectorAll('li')];
  return {
    labels: rows.map((li) => li.textContent.replace(/\\s+/g, ' ').trim()),
    selected: rows.find((li) => li.hasAttribute('aria-selected'))?.textContent.trim() ?? null,
    detail: rows[0]?.querySelector('.cm-completionDetail')?.textContent.trim() ?? null,
    bg: getComputedStyle(box).backgroundColor,
  };
})())`);

await clearAndType('db.orders.aggregate([{ ');
await type('$');
const onDollar = await until(evaluate, `document.querySelector('.cm-tooltip-autocomplete')`);
check('typing $ offers the operators', onDollar);

await type('unw');
const narrowed = await until(evaluate,
  `document.querySelector('.cm-tooltip-autocomplete li')?.textContent.includes('$unwind')`);
const shown = await popup();
check('typing more narrows it to what matches', narrowed,
  JSON.stringify(shown?.labels?.slice(0, 4)));
check('each one says what kind of operator it is', shown?.detail === 'stage',
  JSON.stringify(shown?.detail));
// Styled from the token set, not left in CodeMirror's own white box. Compared
// against the live token rather than a hex literal, so this passes in whichever
// theme the machine running it happens to be in - and still fails if the rules
// stop applying.
const panel2 = await evaluate(`JSON.stringify((() => {
  const probe = document.createElement('div');
  probe.style.cssText = 'background: var(--panel-2)';
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return c;
})())`);
check('the popup is themed', shown?.bg === panel2, `popup ${shown?.bg}, --panel-2 ${panel2}`);

// The help panel beside the list, which is where the one-line meaning lives.
// Hit-tested rather than merely found in the DOM: it is a CHILD of the popup and
// sits outside it, so an `overflow: hidden` on the popup leaves it present,
// correctly sized and never painted. That is exactly what shipped for an hour,
// and only a screenshot noticed.
await until(evaluate, `document.querySelector('.cm-completionInfo')`);
const helpPanel = await evaluate(`JSON.stringify((() => {
  const el = document.querySelector('.cm-completionInfo');
  if (!el) return { painted: false, why: 'not in the DOM' };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return { painted: false, why: 'zero size' };
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return {
    painted: Boolean(hit) && (el === hit || el.contains(hit)),
    hit: hit?.className ?? null,
    code: el.querySelectorAll('code').length,
    text: el.textContent.slice(0, 60),
  };
})())`);
check('the one-line meaning is painted, not just present', helpPanel.painted === true,
  JSON.stringify(helpPanel));

// CodeMirror ignores Enter for `interactionDelay` (75ms by default) after the
// popup last changed, so a keystroke already in flight cannot accept something
// the user has not seen. A person clears that without trying; this has to wait
// for it on purpose.
await new Promise((r) => setTimeout(r, 150));
await press('Enter');
const accepted = await doc();
check('Enter accepts the completion', accepted.includes('$unwind'), JSON.stringify(accepted));

// $map's description mentions `$unwind` in backticks, which is what makes this
// worth asserting: $unwind's own description has none, so checking it there
// passed for the wrong reason.
await clearAndType('db.orders.aggregate([{ ');
await type('$ma');
await until(evaluate, `document.querySelector('.cm-completionInfo code')`, { tries: 40 });
const rendered = await evaluate(`JSON.stringify((() => {
  const el = document.querySelector('.cm-completionInfo');
  return {
    selected: document.querySelector('.cm-tooltip-autocomplete li[aria-selected]')?.textContent ?? null,
    code: [...el.querySelectorAll('code')].map((c) => c.textContent),
    hasBacktick: el.textContent.includes(String.fromCharCode(96)),
  };
})())`);
check('backticks in a description become code, not backticks',
  rendered.code.includes('$unwind') && !rendered.hasBacktick, JSON.stringify(rendered));

// A $ inside a string is a field path - "$items.price" - not an operator, and
// this is the one place a wrong suggestion would appear on every single query.
await clearAndType('db.orders.aggregate([{ $unwind: "');
await type('$');
const inString = await until(evaluate, `document.querySelector('.cm-tooltip-autocomplete')`,
  { tries: 8, gap: 40 });
check('but not inside a string, where $ means a field path', !inString);

// Escape has to close the popup without also blurring, or the editor's own
// keyboard escape hatch eats the dismissal.
await clearAndType('db.orders.aggregate([{ ');
await type('$gr');
await until(evaluate, `document.querySelector('.cm-tooltip-autocomplete')`);
await press('Escape');
const afterEscape = await evaluate(`JSON.stringify({
  popup: Boolean(document.querySelector('.cm-tooltip-autocomplete')),
  focused: document.activeElement === document.querySelector('.cm-content'),
})`);
check('Escape closes the popup and stays in the editor',
  !afterEscape.popup && afterEscape.focused, JSON.stringify(afterEscape));

// And Ctrl+Enter must still run, rather than being swallowed by the popup.
await clearAndType('db.products.find({ ');
await type('$');
await until(evaluate, `document.querySelector('.cm-tooltip-autocomplete')`);
await press('Backspace');
await type('category: "Audio" })');
await press('Enter', CTRL);
const ranWithPopup = await until(evaluate,
  `/\\b2 rows\\b/.test(document.getElementById('resultMeta').textContent)`);
check('Ctrl+Enter still runs the query', ranWithPopup,
  await evaluate(`JSON.stringify(document.getElementById('resultMeta').textContent)`));

/* ---------- 11. Escape is the way out ---------- */

// Tab indents inside the editor, which makes it a focus trap - the documented
// cost of that binding. Escape is what pays it off, and nothing else in the app
// would notice if it stopped working.
await focusEditor();
// One Escape, deliberately. A completion source that has run leaves CodeMirror
// reporting "active" long after the popup has gone, and its own Escape binding
// consumes the key on that - so this check failed the moment autocomplete
// landed, needing two presses. See the Escape binding in src/scripts/editor.js.
await press('Escape');
const blurred = await evaluate(
  `JSON.stringify(!document.querySelector('.cm-content').contains(document.activeElement)
    && document.activeElement !== document.querySelector('.cm-content'))`);
check('Escape leaves the editor, so Tab-to-indent is not a keyboard trap', blurred);

/* ---------- 12. the lesson pages get it too ---------- */

await send('Page.navigate', { url: base + '/learn/find-and-findone/' });
await until(evaluate, `document.querySelector('.rx-btn')`);
// The point of loading the facade on the click rather than importing it at the
// top of the island: a reader who only reads pays for none of it. Asking whether
// CodeMirror *mounted* is not enough - it cannot mount before Edit either way,
// so that check would pass while the bytes were being downloaded on every lesson
// page on the site. Resource timing is what actually answers the question.
const noEditorYet = await evaluate(`(() => {
  const fetched = performance.getEntriesByType('resource').map((e) => e.name.split('/').pop());
  return JSON.stringify({
    cm: Boolean(document.querySelector('.cm-content')),
    boxes: document.querySelectorAll('.rx').length,
    editorChunks: fetched.filter((n) => /^(editor|dist)\\./.test(n)),
    js: fetched.filter((n) => n.endsWith('.js')),
  });
})()`);
check('a lesson page has no editor on it until Edit is pressed',
  !noEditorYet.cm && noEditorYet.boxes === 3, JSON.stringify(noEditorYet));
check('and has not downloaded one either',
  noEditorYet.editorChunks.length === 0, noEditorYet.editorChunks.join(', '));
// Counting requests is not enough on its own: Vite will fold a small module into
// the chunk that imports it, and then the bytes arrive with no new request to
// count. The gzipped budget in test/links.mjs is what closes that hole.

await evaluate(
  `JSON.stringify(Boolean([...document.querySelectorAll('.rx-btn')].find((b) => b.textContent === 'Edit').click() ?? true))`);
const lessonUp = await until(evaluate, `document.querySelector('.rx-editor.cm-editor')`);
check('Edit mounts CodeMirror on a lesson page as well', lessonUp);

if (lessonUp) {
  const lesson = await evaluate(`(() => {
    const box = document.querySelector('.rx-editor.cm-editor');
    const scroller = box.querySelector('.cm-scroller');
    return JSON.stringify({
      code: box.querySelector('.cm-content').innerText,
      size: getComputedStyle(scroller).fontSize,
      preSize: getComputedStyle(document.querySelector('.rx pre')).fontSize,
      blockHidden: document.querySelector('.rx pre[data-runnable]').hidden,
    });
  })()`);
  check('it opens on the query that was in the block', lesson.code === 'db.users.find()',
    JSON.stringify(lesson.code));
  // The block and the editor are the same words in the same place; a size change
  // between them makes Edit look like it reloaded the page.
  check('and at the same size as the block it replaced', lesson.size === lesson.preSize,
    `editor ${lesson.size}, block ${lesson.preSize}`);
  check('the static block is hidden while editing', lesson.blockHidden);

  await focusEditor('.rx-editor .cm-content');
  await press('a', CTRL);
  await press('Backspace');
  await type('db.products.find({ category: "Audio" })');
  await press('Enter', CTRL);
  const lessonRan = await until(evaluate,
    `/\\b2 documents\\b/.test(document.querySelector('.rx-meta').textContent)`);
  check('Ctrl+Enter in a lesson editor runs the edited query', lessonRan,
    await evaluate(`JSON.stringify(document.querySelector('.rx-meta').textContent)`));
}

/* ---------- done ---------- */

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} editor check(s) failed${OFF}\n`);
  process.exit(1);
}
console.log(`\n  ${GREEN}editor OK${OFF}\n`);
process.exit(0);
