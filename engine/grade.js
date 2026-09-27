// Browser-side grading.
//
// Same contract as server/grade.js: the reference solution is executed live
// against the same data as the submission and the two results are diffed, so
// expected answers can never drift out of date with the seed.
//
// Restoring data is far simpler here than on the server - a "reseed" is just
// building a fresh in-memory store. That also means grading a write exercise
// cannot disturb whatever the learner has been doing in the playground, which
// the server version had to work at.

import { compare } from './compare.js';
import { runOrThrow } from './run.js';
import { makeMingoDb } from './mingo-db.js';

/**
 * @param dataset  the dataset module (its build() gives a fresh store)
 * @param exercise the full exercise, solution included
 * @param userCode what the learner typed
 */
export async function gradeExercise(dataset, exercise, userCode) {
  const isWrite = exercise.type === 'write';
  const opts = { unordered: !!exercise.unordered, ignore: exercise.ignore || [] };

  const runOn = async (code, verify) => {
    const db = makeMingoDb(dataset.build());
    const value = await runOrThrow(db, code);
    return verify ? runOrThrow(db, verify) : value;
  };

  let expected;
  try {
    expected = await runOn(exercise.solution, isWrite ? exercise.verify : null);
  } catch (err) {
    // The reference solution failing is our bug, not the learner's.
    return { ok: false, error: `Reference solution failed: ${err.message}`, internal: true };
  }

  let actual;
  try {
    actual = await runOn(userCode, isWrite ? exercise.verify : null);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const result = compare(actual, expected, opts);
  return { ok: true, pass: result.pass, diffs: result.diffs, hidden: result.hidden, isWrite };
}
