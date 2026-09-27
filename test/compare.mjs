// Direct tests for engine/compare.js - the rules that decide whether an answer
// is right and what the learner is told about it.
//
// Everything else tests compare() through a whole graded submission, which only
// ever exercises the happy path: every reference solution passes, and one
// obviously wrong answer fails. That left the interesting half unwatched - what
// a *nearly* right answer is told, and how much of it. This suite builds the
// results by hand so it can ask for cases the 38 drills do not produce.
//
//   node test/compare.mjs

import process from 'node:process';

import ecommerce from '../server/datasets/ecommerce.js';
import { EXERCISES } from '../server/exercises/index.js';
import { compare } from '../engine/compare.js';
import { gradeExercise } from '../engine/grade.js';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

const lines = (r) => r.diffs.join('\n        ');
const someLine = (r, re) => r.diffs.some((d) => re.test(d));
const countLines = (r, re) => r.diffs.filter((d) => re.test(d)).length;

/* ---------- the verdict ---------- */

check('identical results pass', compare([{ a: 1 }], [{ a: 1 }]).pass);

check(
  'a different row order passes when the exercise says order does not matter',
  compare([{ _id: 2 }, { _id: 1 }], [{ _id: 1 }, { _id: 2 }], { unordered: true }).pass
);

check(
  '...and fails when it does not say that',
  !compare([{ _id: 2 }, { _id: 1 }], [{ _id: 1 }, { _id: 2 }]).pass
);

check(
  'numbers within floating-point error are equal',
  compare([{ x: 0.1 + 0.2 }], [{ x: 0.3 }]).pass
);

// Not a nicety: a bare average is a single number, and until this was checked
// compare() answered "Not quite" with an empty explanation for one.
const near = compare(0.1 + 0.2, 0.3);
check(
  'a single value within floating-point error passes rather than failing silently',
  near.pass,
  `pass=${near.pass}, diffs=${JSON.stringify(near.diffs)}`
);

check(
  'dates compare by their value, not their object identity',
  compare([{ d: new Date('2020-01-01') }], [{ d: new Date('2020-01-01') }]).pass
);

// ignore:['_id'] means the row's own _id. Stripping every nested one would let a
// wrong answer through, which is why this is asserted in both directions.
check(
  'an ignored field is ignored on the row',
  compare([{ _id: 1, n: 5 }], [{ _id: 2, n: 5 }], { ignore: ['_id'] }).pass
);
check(
  '...and not inside it',
  !compare(
    [{ _id: 1, orders: [{ _id: 9 }] }],
    [{ _id: 2, orders: [{ _id: 8 }] }],
    { ignore: ['_id'] }
  ).pass
);

check(
  'a single value where a list was expected says so',
  compare(5, [{ a: 1 }]).diffs[0]?.startsWith('Wrong shape:')
);

/* ---------- how much is said ---------- */

// The bug this suite was written for. Submitting the starter on a $group drill
// returns raw collection documents, and every field of every row differs.
const rawOrders = Array.from({ length: 200 }, (_, i) => ({
  _id: i,
  userId: 100 + i,
  status: 'completed',
  rating: 4,
  createdAt: new Date('2025-11-05'),
  items: [{ product: 'Keyboard', price: 100, quantity: 2 }],
}));
const grouped = Array.from({ length: 5 }, (_, i) => ({ _id: 100 + i, totalSpent: 900 + i }));

const shape = compare(rawOrders, grouped, { unordered: true });
check(
  'the wrong kind of document is two lines, not ten',
  shape.diffs.length === 2,
  `${shape.diffs.length} lines:\n        ${lines(shape)}`
);
check(
  'the count difference is still the first thing said',
  shape.diffs[0]?.startsWith('Wrong number of results: expected 5, got 200.'),
  lines(shape)
);
check(
  'the field line names what was expected and what came back',
  /totalSpent/.test(shape.diffs[1] || '') && /userId/.test(shape.diffs[1] || ''),
  lines(shape)
);
check(
  'no field is complained about once per row',
  !someLine(shape, /extra field/),
  lines(shape)
);

// Extra fields, but every expected field present: the projection is wrong and so
// is one value, and one round of feedback should say both.
const withExtras = compare(
  [
    { _id: 'A', total: 10, createdAt: 1 },
    { _id: 'B', total: 99, createdAt: 2 },
  ],
  [
    { _id: 'A', total: 10 },
    { _id: 'B', total: 20 },
  ],
  { unordered: true }
);
check(
  'an extra field is reported once, not once per row',
  countLines(withExtras, /createdAt/) === 1,
  lines(withExtras)
);
check(
  '...and the wrong value underneath it is still reported',
  someLine(withExtras, /row _id="B".*expected 20, got 99/),
  lines(withExtras)
);

// Many rows on one side only.
const expected18 = Array.from({ length: 18 }, (_, i) => ({ name: `right${i}` }));
const actual30 = Array.from({ length: 30 }, (_, i) => ({ name: `wrong${i}` }));
const wholeSet = compare(actual30, expected18, { unordered: true });
check(
  'thirty wrong rows are summarised, not listed',
  wholeSet.diffs.length <= 4,
  `${wholeSet.diffs.length} lines:\n        ${lines(wholeSet)}`
);
check(
  'the summary says how many rows are missing and shows one',
  someLine(wholeSet, /18 expected rows are missing, e\.g\. .*right0/),
  lines(wholeSet)
);
check(
  'the summary says how many rows should not be there',
  someLine(wholeSet, /30 of your rows are not in the answer/),
  lines(wholeSet)
);

// Two of something is worth printing in full; the summary is for runs.
const twoMissing = compare(
  [{ name: 'a' }],
  [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
  { unordered: true }
);
check(
  'two missing rows are printed rather than counted',
  countLines(twoMissing, /^Missing row: /) === 2,
  lines(twoMissing)
);

// Truncation has to say that it truncated.
const fifty = Array.from({ length: 50 }, (_, i) => ({ i, v: i }));
const fiftyOff = Array.from({ length: 50 }, (_, i) => ({ i, v: i + 1 }));
const long = compare(fiftyOff, fifty);
check(
  'a long diff is cut to six lines',
  long.diffs.length === 6,
  `${long.diffs.length} lines:\n        ${lines(long)}`
);
check(
  'the cut counts what it is not showing',
  long.hidden === 44,
  `hidden=${long.hidden}`
);
check(
  'the count is not smuggled in as another difference',
  !someLine(long, /not shown|more difference/),
  lines(long)
);
check(
  'a diff that fits has nothing hidden',
  compare([{ a: 1 }], [{ a: 2 }]).hidden === 0
);

// A row that is not there at all is a bigger fact than a wrong number inside a
// row that is, so rows present on one side only are reported before values. With
// a display limit that ordering is the difference between seeing it and not.
const buried = compare(
  Array.from({ length: 8 }, (_, i) => ({ i, v: i + 1 })),
  Array.from({ length: 10 }, (_, i) => ({ i, v: i }))
);
check(
  'a missing row is still visible behind a screenful of wrong values',
  someLine(buried, /^Missing row: /),
  lines(buried)
);

/* ---------- and the cap must not eat the useful case ---------- */

// The whole risk of this feature: a nearly-right answer losing the one precise
// line that would have explained it. Every check above could pass with a
// compare() that only ever said "wrong shape".
const nearMiss = compare(
  [
    { _id: 'Laptop', revenue: 50 },
    { _id: 'Mouse', revenue: 50 },
  ],
  [
    { _id: 'Laptop', revenue: 2000 },
    { _id: 'Mouse', revenue: 50 },
  ],
  { unordered: true }
);
check(
  'one wrong number in an otherwise right answer is one precise line',
  nearMiss.diffs.length === 1 && /row _id="Laptop".revenue: expected 2000, got 50/.test(nearMiss.diffs[0]),
  lines(nearMiss)
);

// The same risk on the positional path, which is a different branch: "this row
// is a different document" must not swallow "this row has one wrong field".
const orderedNearMiss = compare(
  [{ _id: 1, name: 'Diya', age: 40 }, { _id: 2, name: 'Tara', age: 33 }],
  [{ _id: 1, name: 'Diya', age: 41 }, { _id: 2, name: 'Tara', age: 33 }]
);
check(
  'one wrong field in an ordered row names the field, not the whole row',
  orderedNearMiss.diffs.length === 1 && /^row 0\.age: expected 41, got 40$/.test(orderedNearMiss.diffs[0]),
  lines(orderedNearMiss)
);

const oneMissing = compare(
  [{ _id: 'Laptop', n: 1 }],
  [{ _id: 'Laptop', n: 1 }, { _id: 'Mouse', n: 2 }],
  { unordered: true }
);
check(
  'one missing row still names that row',
  someLine(oneMissing, /Missing row for _id "Mouse"/),
  lines(oneMissing)
);

const nestedWrong = compare(
  [{ _id: 1, address: { city: 'Surat', country: 'India' } }],
  [{ _id: 1, address: { city: 'Bangalore', country: 'India' } }]
);
check(
  'a wrong value nested inside a row is still pinpointed by path',
  someLine(nestedWrong, /row 0\.address\.city: expected "Bangalore", got "Surat"/),
  lines(nestedWrong)
);

// The canonical form wraps a Date as {__date}, which is machinery, not something
// anyone typed. Feedback naming it sent the learner looking for a field that
// exists nowhere in the dataset.
const dates = compare(
  [{ _id: 1, createdAt: new Date('2025-11-05') }],
  [{ _id: 1, createdAt: new Date('2026-06-19') }]
);
check(
  'a wrong date is reported as a date, not as a __date wrapper',
  someLine(dates, /row 0\.createdAt: expected "2026-06-19/) && !someLine(dates, /__/),
  lines(dates)
);

check(
  'no difference line contains undefined',
  !someLine(shape, /undefined/) && !someLine(wholeSet, /undefined/) && !someLine(long, /undefined/)
);

/* ---------- against the real drills ---------- */

// Fixtures can be written to suit the rules. This is the same question asked of
// the 38 real exercises: submit the starter, which is what a learner does first,
// and count what comes back.
let worst = { id: '', n: 0 };
const overLimit = [];
for (const ex of EXERCISES) {
  const res = await gradeExercise(ecommerce, ex, ex.starter);
  if (!res.ok || res.pass) continue;      // errors and passes are other code paths
  if (res.diffs.length > worst.n) worst = { id: ex.id, n: res.diffs.length };
  if (res.diffs.length > 6) overLimit.push(`${ex.id}: ${res.diffs.length} lines`);
}
check(
  'no drill answers its own starter with more than six lines',
  overLimit.length === 0,
  overLimit.join('\n        ')
);

// Non-vacuity. The loop above is only meaningful if the starters actually reach
// grading and produce diffs - if they all errored, or all passed, it would check
// nothing and still look green.
check(
  'the starters really are being graded',
  worst.n >= 2,
  `the noisiest starter produced ${worst.n} lines, which suggests nothing was graded`
);

// The specific case in the bug report, held by name so it cannot regress
// quietly: this one used to be ten lines with the useful one at the top.
const grouper = EXERCISES.find((e) => e.id === 'revenue-per-product');
if (!grouper) {
  check('revenue-per-product exists to be checked', false, 'the drill was renamed - update this check');
} else {
  const res = await gradeExercise(ecommerce, grouper, grouper.starter);
  check(
    'revenue-per-product answers its starter in two lines',
    res.ok && !res.pass && res.diffs.length === 2,
    `${res.diffs?.length} lines:\n        ${(res.diffs || []).join('\n        ')}`
  );
}

console.log(`\n  worst starter feedback: ${worst.n} lines (${worst.id})`);
console.log(failed ? `  \x1b[31m${failed} compare check(s) failed\x1b[0m\n` : `  ${green('compare OK')}\n`);
process.exit(failed ? 1 : 0);
