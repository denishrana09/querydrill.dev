// Exercises the browser grading path end to end, with no MongoDB anywhere.
//
// test/conformance.mjs proves the two engines agree. This proves the thing the
// hosted site actually calls: that engine/grade.js accepts every reference
// solution, rejects a wrong answer, and reports a useful diff rather than just
// "wrong". It needs no services, so it is the test that runs on every push.
//
//   node test/browser-grade.mjs

import process from 'node:process';

import ecommerce from '../server/datasets/ecommerce.js';
import { EXERCISES } from '../server/exercises/index.js';
import { gradeExercise } from '../engine/grade.js';
import { makeMingoDb } from '../engine/mingo-db.js';
import { runOrThrow } from '../engine/run.js';
import { whyUseless } from './result-value.mjs';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';

const failures = [];

// 1. Every reference solution must pass its own exercise.
for (const ex of EXERCISES) {
  const result = await gradeExercise(ecommerce, ex, ex.solution);
  if (!result.ok) {
    failures.push(`${ex.id} errored: ${result.error}`);
  } else if (!result.pass) {
    failures.push(`${ex.id} did not pass its own solution: ${result.diffs.join('; ')}`);
  }
}
console.log(
  `  ${failures.length ? RED : GREEN}${EXERCISES.length - failures.length}/${EXERCISES.length}` +
  ` reference solutions pass in browser mode${OFF}`
);

// 1b. Every reference solution must also *return something*.
//
//     Passing is not enough, because the grader compares the learner's result
//     against this solution's result: if the reference returns [], then an empty
//     answer passes and so does a wrong one that happens to match nothing. The
//     drill looks fine in review and is unusable - you type the right query and
//     see no output. Found by following CONTRIBUTING.md and adding a drill that
//     filtered on a field the collection does not have; it passed.
const barren = [];
for (const ex of EXERCISES) {
  const db = makeMingoDb(ecommerce.build());
  try {
    const why = whyUseless(await runOrThrow(db, ex.solution));
    if (why) barren.push(`${ex.id}: ${why}`);
    // A write drill's `verify` is a read that confirms the write, so it only
    // means anything once the solution has run - on the same db, in that order.
    // Checking it against fresh data reports `null` for every upsert, which is
    // what the first version of this did.
    if (ex.verify) {
      const whyVerify = whyUseless(await runOrThrow(db, ex.verify));
      if (whyVerify) barren.push(`${ex.id} (verify query): ${whyVerify}`);
    }
  } catch (err) {
    barren.push(`${ex.id}: ${String(err.message).slice(0, 120)}`);
  }
}
if (barren.length) {
  failures.push(...barren.map((b) => `no visible result - ${b}`));
} else {
  console.log(`  ${GREEN}every reference solution returns something a learner can see${OFF}`);
}

// 1c. If row order is graded, the prompt has to say what the order is.
//
//     `unordered` tells engine/compare.js to ignore order. When it is not set,
//     order counts - and a drill that returns 30 rows in a graded order while the
//     prompt never mentions sorting is asking the learner to guess a hidden rule.
//     Write drills are exempt: you return an update result, and their `verify`
//     query fixes the order itself.
// Word-bounded, and without a bare "order": the first version matched the word
// "orders" in every prompt that names the collection, so it could never fail.
const ORDER_WORDS = ['sort', 'sorts', 'sorted', 'sorting', 'ascending', 'descending', 'newest', 'oldest'];
const saysOrder = (prompt) => {
  const words = prompt.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.some((w) => ORDER_WORDS.includes(w)) || /top \d/i.test(prompt) || /page \d/i.test(prompt);
};
const hiddenOrder = [];
for (const ex of EXERCISES) {
  if (ex.unordered || ex.type === 'write') continue;
  const db = makeMingoDb(ecommerce.build());
  let rows;
  try {
    const value = await runOrThrow(db, ex.solution);
    rows = Array.isArray(value) ? value.length : 1;
  } catch {
    continue;   // already reported by the checks above
  }
  if (rows > 1 && !saysOrder(ex.prompt)) {
    hiddenOrder.push(`${ex.id}: returns ${rows} rows in a graded order, prompt never says which`);
  }
}
if (hiddenOrder.length) {
  failures.push(...hiddenOrder);
} else {
  console.log(`  ${GREEN}every drill whose row order is graded says so in the prompt${OFF}`);
}

// 2. A wrong answer must fail, and must say something specific about why.
//    A grader that silently passes everything would look perfect above.
const probe = EXERCISES.find((e) => e.type !== 'write');
const wrong = await gradeExercise(ecommerce, probe, 'db.users.find({ _id: -1 })');

if (wrong.ok && wrong.pass) {
  failures.push('grader passed an obviously wrong answer - it is not actually checking');
} else if (wrong.ok && !wrong.diffs.length) {
  failures.push('grader failed an answer but produced no explanation');
} else {
  const detail = wrong.ok ? wrong.diffs[0] : wrong.error;
  console.log(`  ${GREEN}wrong answers are rejected with a reason${OFF}`);
  console.log(`  ${DIM}e.g. ${probe.id}: ${detail}${OFF}`);
}

// 3. Grading a write exercise must not leak mutations into the next run.
const write = EXERCISES.find((e) => e.type === 'write');
if (write) {
  const first = await gradeExercise(ecommerce, write, write.solution);
  const second = await gradeExercise(ecommerce, write, write.solution);
  if (!first.pass || !second.pass) {
    failures.push(`${write.id} is not repeatable - data leaked between grading runs`);
  } else {
    console.log(`  ${GREEN}write exercises are repeatable${OFF}`);
  }
}

if (failures.length) {
  console.log(`\n  ${RED}${failures.length} failure(s):${OFF}`);
  for (const f of failures) console.log(`    ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`\n  ${GREEN}browser grading OK${OFF}\n`);
