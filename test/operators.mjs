// The operator list the editor completes from, held to the two things that make
// it trustworthy: it only offers what the engine can run, and it never leaves
// out something the course has just taught.
//
//   node test/operators.mjs

import { OPERATORS } from '../content/operators.js';
import { TOPICS } from '../content/topics.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const OFF = '\x1b[0m';

let failed = 0;
const check = (label, ok, detail = '') => {
  if (ok) return console.log(`  ${GREEN}ok${OFF}    ${label}`);
  failed++;
  console.log(`  ${RED}FAIL${OFF}  ${label}${detail ? `\n        ${detail}` : ''}`);
};

/* ---------- what mingo actually implements ---------- */

// Read out of the engine rather than listed here. An operator this file believes
// in and mingo does not is an editor suggesting something that errors on Run -
// which is worse than no autocomplete, because the learner trusts it.
const registries = await Promise.all([
  import('mingo/operators/query'),
  import('mingo/operators/pipeline'),
  import('mingo/operators/expression'),
  import('mingo/operators/accumulator'),
  import('mingo/operators/update'),
  import('mingo/operators/projection'),
]);
const SUPPORTED = new Set(registries.flatMap((m) => Object.keys(m).filter((k) => k.startsWith('$'))));

check('the engine registries could be read', SUPPORTED.size > 100, `${SUPPORTED.size} operators`);

/* ---------- the list itself ---------- */

const slugs = OPERATORS.map((o) => o.slug);
const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
check('no operator is listed twice', dupes.length === 0, dupes.join(', '));

check('every operator is spelled like one', OPERATORS.every((o) => /^\$[a-zA-Z][a-zA-Z0-9]*$/.test(o.slug)),
  OPERATORS.filter((o) => !/^\$[a-zA-Z][a-zA-Z0-9]*$/.test(o.slug)).map((o) => o.slug).join(', '));

const unsupported = OPERATORS.filter((o) => !SUPPORTED.has(o.slug)).map((o) => o.slug);
check('every operator offered is one the engine can run', unsupported.length === 0,
  `${unsupported.join(', ')} - the editor would be suggesting a query that cannot run here`);

const ROLES = new Set(['filter', 'stage', 'accumulator', 'expression', 'update', 'projection']);
const oddRoles = OPERATORS.flatMap((o) => o.roles.filter((r) => !ROLES.has(r)).map((r) => `${o.slug}: ${r}`));
check('roles come from the closed set', oddRoles.length === 0, oddRoles.join(', '));
check('every operator has at least one role', OPERATORS.every((o) => o.roles.length > 0));

/* ---------- the description shown next to it ---------- */

// This is the whole reason the list is curated rather than dumped out of mingo:
// a popup of 90 names a learner has to already know is worse than nothing.
const badInfo = OPERATORS.filter((o) =>
  typeof o.info !== 'string' || o.info.length < 20 || o.info.length > 190 || !o.info.trim().endsWith('.'));
check('every operator says what it does, in a sentence', badInfo.length === 0,
  badInfo.map((o) => `${o.slug} (${o.info?.length} chars)`).join(', '));

const sharedInfo = Object.entries(
  OPERATORS.reduce((acc, o) => ({ ...acc, [o.info]: [...(acc[o.info] ?? []), o.slug] }), {}),
).filter(([, ids]) => ids.length > 1);
check('no two operators share a description', sharedInfo.length === 0,
  sharedInfo.map(([, ids]) => ids.join(' + ')).join('\n        '));

/* ---------- it must not fall behind the course ---------- */

// The tag vocabulary is narrower than this list on purpose - it has `$gte` and
// no `$gt`, because no lesson is about `$gt`. But the reverse gap would be a
// real bug: a lesson teaching an operator the editor does not know.
const taught = TOPICS.filter((t) => t.kind === 'operator').map((t) => t.slug);
const missing = taught.filter((t) => !slugs.includes(t));
check('every operator the course teaches is offered', missing.length === 0,
  `${missing.join(', ')} - taught in a lesson, unknown to the editor`);

console.log(`        ${OPERATORS.length} operators offered, ${taught.length} of them taught by a lesson`);

console.log(failed ? `\n  ${RED}${failed} operator check(s) failed${OFF}\n` : `\n  ${GREEN}operators OK${OFF}\n`);
process.exit(failed ? 1 : 0);
