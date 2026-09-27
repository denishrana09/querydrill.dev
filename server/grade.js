import { runOrThrow } from './runner.js';
import { reseedCollections } from './seed.js';

// Comparison logic lives in engine/ so the browser can use the same rules.
export { compare } from '../engine/compare.js';
import { compare } from '../engine/compare.js';

/**
 * Grade one submission.
 *
 * The reference solution is run live against the same seeded database rather
 * than compared to hardcoded JSON - hardcoded expectations rot the moment the
 * seed changes, a live reference never does.
 *
 * Write drills are bracketed by re-seeds. Without that, a second attempt would
 * grade against already-mutated data and fail for no visible reason.
 */
export async function gradeExercise(db, exercise, userCode) {
  const opts = { unordered: !!exercise.unordered, ignore: exercise.ignore || [] };
  const isWrite = exercise.type === 'write';
  const touched = exercise.collections || ['users', 'orders', 'products'];
  const dataset = exercise.dataset || 'ecommerce';
  const restore = () => reseedCollections(db.databaseName, dataset, touched);

  let expected;
  let actual;

  if (isWrite) {
    await restore();
    await runOrThrow(db, exercise.solution);
    expected = await runOrThrow(db, exercise.verify);

    await restore();
    try {
      await runOrThrow(db, userCode);
    } catch (err) {
      await restore();
      return { ok: false, error: err.message };
    }
    actual = await runOrThrow(db, exercise.verify);
    await restore();
  } else {
    expected = await runOrThrow(db, exercise.solution);
    try {
      actual = await runOrThrow(db, userCode);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  const result = compare(actual, expected, opts);
  return { ok: true, pass: result.pass, diffs: result.diffs, hidden: result.hidden, isWrite };
}
