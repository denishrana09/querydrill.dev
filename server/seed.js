import { pathToFileURL } from 'node:url';
import { getDb, assertWritableDb, closeClient } from './mongo.js';
import notes from './datasets/notes.js';
import ecommerce from './datasets/ecommerce.js';

export const DATASETS = { notes, ecommerce };

export function listDatasets() {
  return Object.values(DATASETS).map((d) => ({
    key: d.key,
    label: d.label,
    description: d.description,
    collections: Object.keys(d.build()),
  }));
}

/**
 * Drop-then-insert, but only the collections this dataset owns - never the
 * whole database, so anything else living in there survives.
 */
export async function seedDatabase(dbName, datasetKey) {
  assertWritableDb(dbName);
  const dataset = DATASETS[datasetKey];
  if (!dataset) throw new Error(`Unknown dataset "${datasetKey}".`);

  const db = await getDb(dbName);
  const data = dataset.build();
  const counts = {};

  for (const [name, docs] of Object.entries(data)) {
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: true });
    counts[name] = docs.length;
  }

  return { db: dbName, dataset: datasetKey, counts };
}

/** Restore a single collection - used to bracket the destructive write drills. */
export async function reseedCollections(dbName, datasetKey, names) {
  assertWritableDb(dbName);
  const dataset = DATASETS[datasetKey];
  if (!dataset) throw new Error(`Unknown dataset "${datasetKey}".`);

  const db = await getDb(dbName);
  const data = dataset.build();

  for (const name of names) {
    const docs = data[name];
    if (!docs) throw new Error(`Dataset "${datasetKey}" has no collection "${name}".`);
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: true });
  }
}

// --- CLI: npm run seed -- --db practice --dataset ecommerce -------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const dbName = args.db || 'practice';
  const datasetKey = args.dataset || 'ecommerce';

  try {
    const result = await seedDatabase(dbName, datasetKey);
    console.log(`Seeded "${result.dataset}" into database "${result.db}":`);
    for (const [name, n] of Object.entries(result.counts)) console.log(`  ${name.padEnd(10)} ${n}`);
  } catch (err) {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await closeClient();
  }
}
