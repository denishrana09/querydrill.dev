// Runs every exercise's own reference solution through the grader.
// An exercise that fails its own solution is a broken exercise - this catches
// that at boot instead of mid-practice.

import { getDb, getClient, closeClient } from './mongo.js';
import { seedDatabase, reseedCollections } from './seed.js';
import { EXERCISES } from './exercises/index.js';
import { gradeExercise } from './grade.js';
import { runOrThrow } from './runner.js';

export async function selfCheck(dbName = '__practice_selfcheck', { verbose = false } = {}) {
  await seedDatabase(dbName, 'ecommerce');
  const db = await getDb(dbName);
  const failures = [];
  const warnings = [];

  for (const ex of EXERCISES) {
    let rows = null;
    try {
      // For a write drill the verify query is only meaningful AFTER the
      // mutation, so apply the solution first and restore afterwards.
      let value;
      if (ex.type === 'write') {
        const cols = ex.collections || ['users', 'orders', 'products'];
        await reseedCollections(dbName, ex.dataset || 'ecommerce', cols);
        await runOrThrow(db, ex.solution);
        value = await runOrThrow(db, ex.verify);
        await reseedCollections(dbName, ex.dataset || 'ecommerce', cols);
      } else {
        value = await runOrThrow(db, ex.solution);
      }
      rows = Array.isArray(value) ? value.length : value === null || value === undefined ? 0 : 1;

      const graded = await gradeExercise(db, ex, ex.solution);
      if (!graded.ok) failures.push({ id: ex.id, why: 'errored: ' + graded.error });
      else if (!graded.pass) failures.push({ id: ex.id, why: 'solution does not match itself: ' + graded.diffs.join('; ') });
    } catch (err) {
      failures.push({ id: ex.id, why: 'threw: ' + err.message });
    }

    // A solution returning nothing usually means the exercise cannot discriminate.
    if (rows === 0) warnings.push({ id: ex.id, why: 'returns 0 rows - exercise may not discriminate' });
    if (verbose) console.log(`  ${ex.id.padEnd(7)} ${String(rows).padStart(4)} rows  ${ex.title}`);
  }

  return { total: EXERCISES.length, failures, warnings };
}

const isMain = Boolean(process.argv[1] && process.argv[1].endsWith('selfcheck.js'));

if (isMain) {
  try {
    const { total, failures, warnings } = await selfCheck('__practice_selfcheck', { verbose: true });
    console.log(`\n${total - failures.length}/${total} exercises pass their own solution.`);
    for (const w of warnings) console.log(`  WARN  ${w.id}: ${w.why}`);
    for (const f of failures) console.log(`  FAIL  ${f.id}: ${f.why}`);
    if (failures.length) process.exitCode = 1;

    // Do not leave the scratch database cluttering the picker.
    const client = await getClient();
    await client.db('__practice_selfcheck').dropDatabase();
  } catch (err) {
    console.error('Self-check could not run:', err.message);
    process.exitCode = 1;
  } finally {
    await closeClient();
  }
}
