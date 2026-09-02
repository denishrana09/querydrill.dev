// Dual-engine conformance test.
//
// mingo is a third-party re-implementation of MongoDB's query language, not
// MongoDB. If it ever diverges, the hosted site would silently teach the wrong
// answer - or mark a correct submission wrong. So: run every reference solution
// through BOTH engines against identical seed data and assert the results match
// under the same rules the grader uses.
//
// A red run means either mingo drifted, or a newly added exercise uses something
// browser mode cannot do. Both are things to learn about before users do.
//
//   node test/conformance.mjs            (needs a mongod on 127.0.0.1:27017)
//   node test/conformance.mjs --verbose

import process from 'node:process';

import { EXERCISES } from '../server/exercises/index.js';
import { compare } from '../server/grade.js';
import { getDb, closeClient } from '../server/mongo.js';
import { seedDatabase, reseedCollections, DATASETS } from '../server/seed.js';
import { runOrThrow as runDriver } from '../server/runner.js';
import { makeMingoDb } from '../engine/mingo-db.js';
import { runOrThrow as runMingo } from '../engine/run.js';

const DB_NAME = process.env.CONFORMANCE_DB || 'conformance_check';
const VERBOSE = process.argv.includes('--verbose');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';

/** Fresh in-memory store, regenerated from the same deterministic builder. */
const freshStore = (key) => DATASETS[key].build();

async function main() {
  console.log(`\n  Dual-engine conformance: real MongoDB vs mingo`);
  console.log(`  ${EXERCISES.length} exercises, database "${DB_NAME}"\n`);

  const seeded = new Set();
  const failures = [];
  let passed = 0;

  for (const ex of EXERCISES) {
    const dataset = ex.dataset || 'ecommerce';
    const touched = ex.collections || ['users', 'orders', 'products'];

    if (!seeded.has(dataset)) {
      await seedDatabase(DB_NAME, dataset);
      seeded.add(dataset);
    }

    const realDb = await getDb(DB_NAME);
    const store = freshStore(dataset);
    const memDb = makeMingoDb(store, DB_NAME);

    let real, mem, error = null;

    try {
      if (ex.type === 'write') {
        // Write drills mutate; bracket both engines with a restore so each
        // starts from identical data, then compare what `verify` observes.
        await reseedCollections(DB_NAME, dataset, touched);
        await runDriver(realDb, ex.solution);
        real = await runDriver(realDb, ex.verify);
        await reseedCollections(DB_NAME, dataset, touched);

        await runMingo(memDb, ex.solution);
        mem = await runMingo(memDb, ex.verify);
      } else {
        real = await runDriver(realDb, ex.solution);
        mem = await runMingo(memDb, ex.solution);
      }
    } catch (err) {
      error = err.message;
    }

    if (error) {
      failures.push({ ex, reason: 'threw', detail: error });
      console.log(`  ${RED}ERROR${OFF}  ${ex.id}  ${ex.title}`);
      console.log(`         ${DIM}${error}${OFF}`);
      continue;
    }

    const { pass, diffs } = compare(mem, real, {
      unordered: !!ex.unordered,
      ignore: ex.ignore || [],
    });

    if (pass) {
      passed++;
      if (VERBOSE) console.log(`  ${GREEN}ok${OFF}     ${ex.id}  ${ex.title}`);
    } else {
      failures.push({ ex, reason: 'diverged', detail: diffs.join('; ') });
      console.log(`  ${RED}DIFF${OFF}   ${ex.id}  ${ex.title}`);
      for (const d of diffs.slice(0, 3)) console.log(`         ${DIM}${d}${OFF}`);
    }
  }

  const total = EXERCISES.length;
  console.log(
    `\n  ${failures.length ? RED : GREEN}${passed}/${total} exercises agree` +
    ` across both engines${OFF}\n`
  );

  if (failures.length) {
    console.log('  Not safe for browser mode:');
    for (const f of failures) console.log(`    ${f.ex.id}  ${f.ex.title}  (${f.reason})`);
    console.log('');
  }

  return failures.length ? 1 : 0;
}

let code = 1;
try {
  code = await main();
} catch (err) {
  console.error(`\n  Conformance run failed: ${err.message}`);
  console.error('  Is mongod running on 127.0.0.1:27017?\n');
} finally {
  await closeClient();
}
process.exit(code);
