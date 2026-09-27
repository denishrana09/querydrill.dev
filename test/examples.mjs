// Executes every code block the site offers a Run button on.
//
// The rule in engine/runnable.js is a pattern match, not a parser - it decides
// that `db.users.find(...)` is a query and that a bare `{ $group: {...} }` is a
// teaching fragment. This file is what makes that guess safe: it runs all of
// them against the shipped dataset and fails if any throws.
//
// It also fails on a block that runs but returns nothing, which is the more
// interesting bug. An example querying `{ _id: 1 }` against a collection whose
// ids start at 101 is not broken code, it is a broken lesson - the reader presses
// Run, gets `null`, and concludes the site is wrong. Six of those were sitting in
// the content before this test existed.

import { readFileSync, readdirSync } from 'node:fs';
import { makeMingoDb } from '../engine/mingo-db.js';
import { runOrThrow } from '../engine/run.js';
import ecommerce from '../server/datasets/ecommerce.js';
import { fencesIn, isRunnable, NO_RUN } from '../engine/runnable.js';
import { whyUseless } from './result-value.mjs';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

/* ---------- collect ---------- */

const pages = [];
for (const dir of ['content/lessons', 'content/reference']) {
  for (const file of readdirSync(new URL(`../${dir}`, import.meta.url))) {
    const source = readFileSync(new URL(`../${dir}/${file}`, import.meta.url), 'utf8');
    pages.push({ id: `${dir.split('/')[1]}/${file}`, fences: fencesIn(source) });
  }
}

const runnable = pages.flatMap((p) => p.fences.filter((f) => f.runnable).map((f) => ({ ...f, page: p.id })));
const withAny = pages.filter((p) => p.fences.some((f) => f.runnable));

const threw = [];
const empty = [];

for (const fence of runnable) {
  // A fresh dataset per block, because the test must not depend on the order the
  // files happen to be read in. The page itself deliberately shares one db - see
  // src/scripts/runnable.js - but that is a property of a page, not of a fence.
  const db = makeMingoDb(ecommerce.build());
  const first = fence.code.split('\n')[0].slice(0, 58);
  try {
    const why = whyUseless(await runOrThrow(db, fence.code));
    if (why) empty.push(`${fence.page}: ${why}\n          ${first}`);
  } catch (err) {
    threw.push(`${fence.page}: ${String(err.message).split('\n')[0]}\n          ${first}`);
  }
}

check('every runnable example executes without error', threw.length === 0, threw.join('\n        '));
check('every runnable example returns something worth showing', empty.length === 0, empty.join('\n        '));

/* ---------- the opt-out stays honest ---------- */

// A ```js no-run marker on a block that the rule would not have picked up anyway
// is dead weight that implies a reason it does not have. Removing it is free;
// leaving it makes the next reader hunt for a problem that is not there.
const stale = [];
for (const page of pages) {
  for (const fence of page.fences) {
    if (!fence.meta.split(/\s+/).includes(NO_RUN)) continue;
    if (!isRunnable(fence.code, fence.lang, '')) {
      stale.push(`${page.id}: ${fence.code.split('\n')[0].slice(0, 58)}`);
    }
  }
}
check(`every \`${NO_RUN}\` marker is on a block that would otherwise run`, stale.length === 0,
  stale.join('\n        '));

/* ---------- the feature cannot quietly switch itself off ---------- */

// Every lesson has one, so "every lesson has one" is the check - a number would
// only say the rule still matches something. A typo in the rule, or a renamed
// collection, turns all 54 pages back into plain text and this is the alarm.
const lessonsWithout = pages
  .filter((p) => p.id.startsWith('lessons/') && !p.fences.some((f) => f.runnable))
  .map((p) => p.id);
check('every lesson has at least one runnable example', lessonsWithout.length === 0,
  lessonsWithout.join(', '));

// The two listed here are pure tables - there is no query on them to run. Any
// other reference page that has JavaScript in it should have a runnable example,
// so this stays a named exception rather than a blanket exemption.
const TABLES_ONLY = ['reference/operator-cheatsheet.md', 'reference/operator-comparisons.md'];
const refWithout = pages
  .filter((p) => p.id.startsWith('reference/') && !TABLES_ONLY.includes(p.id))
  .filter((p) => !p.fences.some((f) => f.runnable))
  .map((p) => p.id);
check('every reference page with code has a runnable example', refWithout.length === 0,
  refWithout.join(', '));

const staleExemption = TABLES_ONLY.filter(
  (id) => pages.find((p) => p.id === id)?.fences.some((f) => f.lang === 'js'));
check('the tables-only exemption is still accurate', staleExemption.length === 0,
  `${staleExemption.join(', ')} now has JavaScript in it`);

console.log(
  `\n  ${runnable.length} runnable example(s) on ${withAny.length} of ${pages.length} pages` +
  ` · ${pages.length - withAny.length} page(s) have none yet`
);
console.log(failed ? `\n  \x1b[31m${failed} example check(s) failed\x1b[0m\n` : `\n  ${green('examples OK')}\n`);
process.exit(failed ? 1 : 0);
