import batch1 from './batch1.js';
import batch2 from './batch2.js';
import batch3 from './batch3.js';
import { MODULES, MODULE_OF_EXERCISE, EXERCISE_ORDER, ALL_LESSONS } from '../../content/curriculum.js';
import { isTopic } from '../../content/topics.js';

// The batch*.js filenames are only how the exercises are stored. Where an
// exercise sits in the course, and in what order, comes from the curriculum.
const RAW = [...batch1, ...batch2, ...batch3];

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const LESSON_SLUGS = new Set(ALL_LESSONS.map((l) => l.slug));

// Fail at import time rather than halfway through a practice session.
const seen = new Set();
for (const e of RAW) {
  for (const field of ['id', 'title', 'prompt', 'solution', 'starter', 'lesson', 'difficulty']) {
    if (!e[field]) throw new Error(`Exercise ${e.id || '(no id)'} is missing "${field}".`);
  }
  if (seen.has(e.id)) throw new Error(`Duplicate exercise id "${e.id}".`);
  seen.add(e.id);

  // The id is a URL. Keep it one, so a slug can never silently break a link.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) {
    throw new Error(`Exercise id "${e.id}" is not a URL slug.`);
  }
  if (!DIFFICULTIES.has(e.difficulty)) {
    throw new Error(`Exercise ${e.id} has difficulty "${e.difficulty}".`);
  }
  if (!Array.isArray(e.topics) || !e.topics.length) {
    throw new Error(`Exercise ${e.id} needs at least one topic tag.`);
  }
  // A closed vocabulary, checked at import. This is how `sort` and `$sort` both
  // came to exist: nothing was stopping a new spelling of an existing idea, so
  // two of them sat in the table for months. Adding a tag now means adding it to
  // content/topics.js, where the existing ones are visible next to it.
  for (const topic of e.topics) {
    if (!isTopic(topic)) {
      throw new Error(
        `Exercise ${e.id} uses topic "${topic}", which is not in content/topics.js.`
      );
    }
  }
  if (new Set(e.topics).size !== e.topics.length) {
    throw new Error(`Exercise ${e.id} lists the same topic twice.`);
  }
  if (!LESSON_SLUGS.has(e.lesson)) {
    throw new Error(`Exercise ${e.id} points at unknown lesson "${e.lesson}".`);
  }
  if (!MODULE_OF_EXERCISE[e.id]) {
    throw new Error(`Exercise ${e.id} is not listed in any module in content/curriculum.js.`);
  }

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

// The curriculum promising a drill that does not exist is the failure that
// would ship a dead link, so check that direction too.
for (const id of EXERCISE_ORDER) {
  if (!seen.has(id)) {
    throw new Error(`Module "${MODULE_OF_EXERCISE[id]}" lists unknown exercise "${id}".`);
  }
}

const byId = new Map(RAW.map((e) => [e.id, e]));
const MODULE_BY_SLUG = new Map(MODULES.map((m) => [m.slug, m]));

export const EXERCISES = EXERCISE_ORDER.map((id) => {
  const module = MODULE_BY_SLUG.get(MODULE_OF_EXERCISE[id]);
  return {
    dataset: 'ecommerce',
    type: 'read',
    ...byId.get(id),
    module: module.slug,
    track: module.track,
  };
});

export function getExercise(id) {
  return EXERCISES.find((e) => e.id === id);
}

/** Drills for one module, in the order the module lists them. */
export function exercisesInModule(slug) {
  return EXERCISES.filter((e) => e.module === slug);
}

/** What the browser is allowed to see - never the solution or verify query. */
export function publicExercise(e) {
  const { solution, verify, ...rest } = e;
  return rest;
}
