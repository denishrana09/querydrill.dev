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
