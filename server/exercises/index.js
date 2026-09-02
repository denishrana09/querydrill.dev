import batch1 from './batch1.js';
import batch2 from './batch2.js';
import batch3 from './batch3.js';

const RAW = [
  ...batch1.map((e) => ({ ...e, batch: 1 })),
  ...batch2.map((e) => ({ ...e, batch: 2 })),
  ...batch3.map((e) => ({ ...e, batch: 3 })),
];

// Fail at import time rather than halfway through a practice session.
const seen = new Set();
for (const e of RAW) {
  for (const field of ['id', 'title', 'prompt', 'solution', 'starter']) {
    if (!e[field]) throw new Error(`Exercise ${e.id || '(no id)'} is missing "${field}".`);
  }
  if (seen.has(e.id)) throw new Error(`Duplicate exercise id "${e.id}".`);
  seen.add(e.id);
  if (e.type === 'write' && !e.verify) {
    throw new Error(`Write exercise ${e.id} needs a "verify" query.`);
  }
}

export const EXERCISES = RAW.map((e) => ({ dataset: 'ecommerce', type: 'read', ...e }));

export function getExercise(id) {
  return EXERCISES.find((e) => e.id === id);
}

/** What the browser is allowed to see - never the solution or verify query. */
export function publicExercise(e) {
  const { solution, verify, ...rest } = e;
  return rest;
}
