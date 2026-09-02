import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDb, listDatabases, listCollections, serverInfo, assertWritableDb } from './mongo.js';
import { seedDatabase, listDatasets } from './seed.js';
import { runCode, toEJSON } from './runner.js';
import { EXERCISES, getExercise, publicExercise } from './exercises/index.js';
import { gradeExercise } from './grade.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, '..', 'public');
const PORT = Number(process.env.PORT) || 4000;
const HOST = '127.0.0.1'; // localhost only - this runs arbitrary code you type

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(PUBLIC_DIR));

const wrap = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    res.status(400).json({ error: err?.message || String(err) });
  });
};

app.get('/api/status', wrap(async (_req, res) => {
  res.json(await serverInfo());
}));

app.get('/api/databases', wrap(async (_req, res) => {
  res.json({ databases: await listDatabases() });
}));

app.get('/api/datasets', wrap(async (_req, res) => {
  res.json({ datasets: listDatasets() });
}));

app.get('/api/collections', wrap(async (req, res) => {
  res.json({ collections: await listCollections(req.query.db) });
}));

app.get('/api/sample', wrap(async (req, res) => {
  const db = await getDb(req.query.db);
  const doc = await db.collection(String(req.query.collection)).findOne({});
  res.json({ ejson: doc ? toEJSON(doc) : null });
}));

app.post('/api/seed', wrap(async (req, res) => {
  const { db, dataset } = req.body || {};
  res.json(await seedDatabase(db, dataset));
}));

app.get('/api/exercises', (_req, res) => {
  res.json({ exercises: EXERCISES.map(publicExercise) });
});

app.post('/api/run', wrap(async (req, res) => {
  const { db: dbName, code } = req.body || {};
  assertWritableDb(dbName);
  const db = await getDb(dbName);
  res.json(await runCode(db, String(code ?? '')));
}));

app.post('/api/check', wrap(async (req, res) => {
  const { db: dbName, id, code } = req.body || {};
  assertWritableDb(dbName);
  const exercise = getExercise(id);
  if (!exercise) throw new Error(`Unknown exercise "${id}".`);
  const db = await getDb(dbName);
  res.json(await gradeExercise(db, exercise, String(code ?? '')));
}));

// Deliberately gated: revealing the answer instantly is how practice stops working.
app.post('/api/solution', wrap(async (req, res) => {
  const exercise = getExercise(req.body?.id);
  if (!exercise) throw new Error('Unknown exercise.');
  res.json({ solution: exercise.solution });
}));

app.listen(PORT, HOST, async () => {
  console.log(`\n  MongoDB practice playground`);
  console.log(`  http://${HOST}:${PORT}\n`);
  try {
    const info = await serverInfo();
    console.log(`  connected to MongoDB ${info.version} at ${info.uri}`);
  } catch (err) {
    console.log(`  WARNING: could not reach MongoDB - ${err.message}`);
    console.log(`  Is mongod running? The page will show the error too.`);
  }
  console.log(`  ${EXERCISES.length} exercises loaded. Ctrl+C to stop.\n`);
});
