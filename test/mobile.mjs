// Loads every built page in a real browser at phone width and fails if any of
// them scrolls sideways.
//
// Horizontal overflow is the mobile bug that does not announce itself: the page
// looks fine in a desktop window narrowed by hand, and on a phone the right edge
// of every line is simply gone. Nothing in a unit test or in jsdom can see it,
// because it needs layout - so this drives headless Chrome over CDP.
//
// The browser plumbing is in test/chrome.mjs, shared with test/editor.mjs. No new
// dependency: Chrome is already on any machine that is going to look at this
// site, the preview server is Astro's own, and Node has had a WebSocket client
// since 22. If no Chrome is found the check says so and skips rather than
// pretending to have passed.
//
//   npm run build && node test/mobile.mjs

import process from 'node:process';
import { openChrome, findBrowser, until, GREEN, RED, DIM, OFF } from './chrome.mjs';
import { allPaths } from '../content/curriculum.js';

const WIDTH = 360;   // a small-but-current phone; anything narrower is rare
const HEIGHT = 780;

if (!findBrowser()) {
  console.log(`  ${DIM}skipped${OFF}  no Chrome or Edge found - set CHROME=/path/to/chrome to run this`);
  process.exit(0);
}

let send;
let evaluate;
let base;
let server;
try {
  ({ send, evaluate, base, server } = await openChrome({
    previewPort: 4331,
    cdpPort: 9333,
    profile: 'mp-mobile-check',
    width: WIDTH,
    height: HEIGHT,
    mobile: true,
  }));
} catch (err) {
  console.log(`  ${RED}FAIL${OFF}  could not start a browser against dist/ - is it built?`);
  console.log(`        ${err.message}`);
  process.exit(1);
}

// Reports the widest thing sticking out, not just that something is - the
// element is the whole answer, and finding it by hand means bisecting the CSS.
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  let worst = null;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    // Something inside its own scroll container is contained, not overflowing.
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden') { clipped = true; break; }
    }
    if (clipped) continue;
    const over = Math.round(r.right - vw);
    if (over > 1 && (!worst || over > worst.over)) {
      worst = {
        over,
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        cls: typeof el.className === 'string' ? el.className : '',
      };
    }
  }
  return JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, vw, worst });
})()`;

/* ---------- the sweep ---------- */

const paths = allPaths();
const bad = [];

for (const path of paths) {
  await send('Page.navigate', { url: base + path });
  // Enough for the CSS to apply and the runnable-example toolbars to be built;
  // none of these pages waits on anything slower.
  await new Promise((r) => setTimeout(r, 220));
  // Except /practice/, which does. The editor arrives as its own chunk a moment
  // after the page, and measuring before it lands measures the textarea that was
  // standing in for it - so an overflowing editor would pass here every time.
  if (path === '/practice/' && !(await until(evaluate, `document.querySelector('.cm-content')`))) {
    bad.push('/practice/ never upgraded its editor, so nothing here measured the real one');
    continue;
  }
  const data = await evaluate(PROBE);
  if (data.scrollWidth > data.vw + 1) {
    const w = data.worst;
    bad.push(
      `${path} scrolls ${data.scrollWidth - data.vw}px sideways` +
      (w ? `\n        widest offender: <${w.tag}${w.id ? '#' + w.id : ''}${w.cls ? '.' + w.cls.trim().split(/\s+/).join('.') : ''}> by ${w.over}px` : '')
    );
  }
}

/* ---------- the pane switcher has to be findable ---------- */

// The first version of this bar sat flush at the bottom in `--panel` on a `--bg`
// page: 1.08:1. A real surface in the token set, and invisible as one - grey
// labels on top of it read as a footer, and people did not find the other two
// panes at all. WCAG 1.4.11 asks for 3:1 on a UI component against what is beside
// it, which is exactly the right question, so it is the one asked here.
await send('Page.navigate', { url: base + '/practice/' });
// Past the bar's entrance animation, so nothing is measured mid-flight.
await new Promise((r) => setTimeout(r, 1100));

const NAV_PROBE = `(() => {
  const bar = document.getElementById('tabbar');
  if (!bar || getComputedStyle(bar).display === 'none') return JSON.stringify({ missing: true });
  const active = bar.querySelector('button[aria-pressed="true"]');
  const buttons = [...bar.querySelectorAll('button')];
  return JSON.stringify({
    pageBg: getComputedStyle(document.body).backgroundColor,
    activeBg: getComputedStyle(active).backgroundColor,
    shortest: Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height))),
    count: buttons.length,
  });
})()`;

const nav = await evaluate(NAV_PROBE);

/* ---------- the topic filters have to be reachable ---------- */

// The filter row wraps on a desktop and scrolls sideways on a phone, because
// eight thumb-sized chips wrap to three rows at 360px - 130-odd pixels of
// filters above the first drill, on the screen with the least room. A single
// scrolling row is only correct if it really scrolls: `nowrap` without an
// overflow container silently clips the last chips and nothing can reach them.
await evaluate(`JSON.stringify(Boolean([...document.querySelectorAll('#tabbar button')]
  .find((b) => b.textContent.includes('Exercises'))?.click() ?? true))`);
await new Promise((r) => setTimeout(r, 250));

const FILTER_PROBE = `(() => {
  const row = document.getElementById('exFilters');
  if (!row) return JSON.stringify({ missing: true });
  const chips = [...row.querySelectorAll('button')];
  if (!chips.length) return JSON.stringify({ empty: true });
  const style = getComputedStyle(row);
  const tops = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top)));
  return JSON.stringify({
    rows: tops.size,
    scrolls: row.scrollWidth > row.clientWidth + 1,
    canScroll: ['auto', 'scroll'].includes(style.overflowX),
    shortest: Math.min(...chips.map((c) => Math.round(c.getBoundingClientRect().height))),
    count: chips.length,
    widest: Math.max(...chips.map((c) => Math.round(c.getBoundingClientRect().right))),
    viewport: document.documentElement.clientWidth,
  });
})()`;

const filters = await evaluate(FILTER_PROBE);

await server.stop();

const channels = (css) => (css.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const relLum = (css) => {
  const [r, g, b] = channels(css)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const navProblems = [];
if (nav.missing) {
  navProblems.push(`no tab bar is shown at ${WIDTH}px - two of the three panes are unreachable`);
} else {
  const ratio = contrast(nav.activeBg, nav.pageBg);
  if (ratio < 3) {
    navProblems.push(
      `the selected tab is ${ratio.toFixed(2)}:1 against the page and needs 3:1 ` +
      `(${nav.activeBg} on ${nav.pageBg})`
    );
  }
  // Something you can see but cannot reliably hit is only half-fixed.
  if (nav.shortest < 44) {
    navProblems.push(`the smallest tab is ${nav.shortest}px tall; 44px is the minimum touch target`);
  }
  if (nav.count !== 3) navProblems.push(`expected 3 panes in the tab bar, found ${nav.count}`);
}

const filterProblems = [];
if (filters.missing) {
  filterProblems.push('there is no topic filter row on the practice page');
} else if (filters.empty) {
  filterProblems.push('the filter row rendered no chips');
} else {
  if (filters.rows > 1) {
    filterProblems.push(
      `the chips wrap to ${filters.rows} rows at ${WIDTH}px - that is ${filters.rows * filters.shortest}px ` +
      'of filters above the first drill; they should be one scrolling row'
    );
  }
  // Clipped and unreachable is the failure mode of `nowrap`, so if the row is
  // wider than its box it has to be scrollable.
  if (filters.scrolls && !filters.canScroll) {
    filterProblems.push('the chips are wider than the row but it does not scroll - the last ones cannot be reached');
  }
  if (filters.shortest < 40) {
    filterProblems.push(`the smallest filter chip is ${filters.shortest}px tall; too small to tap reliably`);
  }
}

/* ---------- report ---------- */

let failed = 0;

if (bad.length) {
  failed++;
  console.log(`  ${RED}FAIL${OFF}  ${bad.length} of ${paths.length} pages overflow at ${WIDTH}px`);
  for (const b of bad) console.log(`        ${b}`);
} else {
  console.log(`  ${GREEN}ok${OFF}    all ${paths.length} pages fit ${WIDTH}px with no sideways scroll`);
}

if (navProblems.length) {
  failed++;
  console.log(`  ${RED}FAIL${OFF}  the pane switcher is not findable at ${WIDTH}px`);
  for (const n of navProblems) console.log(`        ${n}`);
} else {
  console.log(`  ${GREEN}ok${OFF}    the pane switcher stands out from the page and is thumb-sized`);
}

if (filterProblems.length) {
  failed++;
  console.log(`  ${RED}FAIL${OFF}  the topic filters do not work at ${WIDTH}px`);
  for (const f of filterProblems) console.log(`        ${f}`);
} else {
  console.log(
    `  ${GREEN}ok${OFF}    the ${filters.count} topic filters sit in one` +
    `${filters.scrolls ? ' scrollable' : ''} row and are thumb-sized`
  );
}

console.log(failed ? `\n  ${RED}${failed} mobile check(s) failed${OFF}\n` : `\n  ${GREEN}mobile OK${OFF}\n`);
process.exit(failed ? 1 : 0);
