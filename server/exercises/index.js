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
  // A scaffold is the optional "more structure" step up from the starter. If it
  // matches the starter it is a no-op button, which is worse than no button.
  if (e.scaffold && e.scaffold === e.starter) {
    throw new Error(`Exercise ${e.id} has a "scaffold" identical to its starter.`);
  }
  // Starters must not contain the answer. This is a blunt check - it only
  // catches a starter that already *is* the solution - but it stops the most
  // obvious regression while the rest stays a judgement call.
  if (e.starter.replace(/\s/g, '') === e.solution.replace(/\s/g, '')) {
    throw new Error(`Exercise ${e.id} ships its own solution as the starter.`);
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
