// Reads the real palettes out of global.css and checks every foreground token
// against the surfaces it is actually painted on.
//
// A light theme is easy to add and easy to get subtly wrong: a grey that reads
// fine on #16181d can be unreadable on #f6f8fa, and nothing fails loudly. This
// is the check that makes the second palette safe to change.

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

/** Pull `--name: value;` pairs out of the block that starts at `selector`. */
function palette(selector) {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`no ${selector} block in global.css`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])
  );
}

const channels = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = channels(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

// Foreground tokens, and the AA floor each one has to clear. Body-sized text
// needs 4.5; the two listed at 3.0 are only ever used on large or non-text
// elements, and saying so here is what stops that being an excuse later.
const FOREGROUNDS = {
  text: 4.5,
  'text-soft': 4.5,
  muted: 4.5,
  'muted-2': 4.5,
  accent: 4.5,
  danger: 4.5,
  warn: 4.5,
  attn: 4.5,
  'syn-key': 4.5,
  'syn-string': 4.5,
  'syn-number': 4.5,
  'syn-bool': 4.5,
  'syn-date': 4.5,
};

// Deliberately not in the list above: `--accent-dim` is a button fill, not a
// foreground - what matters is `--on-accent-dim` against it, which is checked
// separately below. `--line-strong` is a hover border on an element that is
// already outlined by `--line`; it carries no state and no text.

for (const [name, selector] of [
  ['dark', ":root,\n:root[data-theme='dark']"],
  ['light', ":root[data-theme='light']"],
]) {
  const p = palette(selector);
  const surfaces = [p.bg, p.panel, p['panel-2']];
  check(`${name}: palette parsed`, Boolean(p.bg && p.panel && p['panel-2']));

  const bad = [];
  for (const [token, floor] of Object.entries(FOREGROUNDS)) {
    const value = p[token];
    if (!value) { bad.push(`${token} is missing`); continue; }
    if (!value.startsWith('#')) continue; // rgba() tokens are overlays, not text
    const worst = Math.min(...surfaces.map((s) => ratio(value, s)));
    if (worst < floor) bad.push(`--${token} ${value} = ${worst.toFixed(2)} (needs ${floor})`);
  }
  check(`${name}: every foreground token clears its contrast floor`, bad.length === 0,
    bad.join('\n        '));

  // Text on a filled accent button is the one pairing that is not against a
  // surface, and it is the easiest to get wrong when inverting a palette.
  check(`${name}: text on accent fills is readable`,
    ratio(p['on-accent'], p.accent) >= 4.5 && ratio(p['on-accent-dim'], p['accent-dim']) >= 4.5,
    `on-accent ${ratio(p['on-accent'], p.accent).toFixed(2)}, ` +
    `on-accent-dim ${ratio(p['on-accent-dim'], p['accent-dim']).toFixed(2)}`);
}

// Both blocks must define the same tokens, or switching theme leaves a value
// inherited from the other one and the bug only appears in a single component.
const dark = palette(":root,\n:root[data-theme='dark']");
const light = palette(":root[data-theme='light']");
// No exceptions: the font tokens used to need one and now live in their own
// :root rule, because they are not palette values and saying so in the
// stylesheet is better than saying it again here.
const onlyDark = Object.keys(dark).filter((k) => !(k in light));
check('the light palette defines every token the dark one does', onlyDark.length === 0,
  onlyDark.map((k) => `--${k}`).join(', '));

console.log(failed ? `\n  \x1b[31m${failed} contrast check(s) failed\x1b[0m\n` : `\n  ${green('contrast OK')}\n`);
process.exit(failed ? 1 : 0);
