// The curriculum: tracks -> modules -> lessons, plus each module's drill queue.
//
// This file is pure data with no imports, so the Astro build, the practice app
// and the test suite all read the same ordering. It is the single source of
// truth for URLs: a lesson's `slug` is its page, a module's `slug` is its hub
// page, and an exercise's `id` is its practice URL.
//
// Ordering lives here; prose lives in `content/lessons/<slug>.md`. Each lesson
// keeps its title in both places - this file needs it for navigation without
// parsing 54 markdown files, and `test/curriculum.mjs` fails if the two drift.

export const TRACKS = [
  {
    slug: 'fundamentals',
    title: 'MongoDB fundamentals',
    summary:
      'Querying and updating documents: find, operators, nested data, arrays, sorting and writes.',
  },
  {
    slug: 'aggregation',
    title: 'Aggregation',
    summary:
      'The pipeline: filtering, reshaping, grouping, and flattening arrays with $unwind.',
  },
  {
    slug: 'advanced-aggregation',
    title: 'Advanced aggregation',
    summary:
      'Joins, array expression operators, conditionals, $facet, dates, and full interview problems.',
  },
];

export const MODULES = [
  /* ---------- Track A: fundamentals ---------- */
  {
    slug: 'documents-and-find',
    track: 'fundamentals',
    title: 'Documents and find()',
    summary: 'How MongoDB stores data, and how to read it back.',
    goal: 'Read documents out of a collection and control which fields come back.',
    lessons: [
      { slug: 'how-mongodb-stores-data', title: 'How MongoDB stores data' },
      { slug: 'find-and-findone', title: 'find() and findOne()' },
      { slug: 'projection', title: 'Projection: choosing fields' },
    ],
    exercises: ['find-with-projection'],
  },
  {
    slug: 'query-operators',
    track: 'fundamentals',
    title: 'Query operators',
    summary: 'Comparison, set membership, and boolean logic inside a filter.',
    goal: 'Express any single-collection condition without writing a loop.',
    lessons: [
      { slug: 'comparison-operators', title: 'Comparison operators' },
      { slug: 'in-and-nin', title: '$in and $nin' },
      { slug: 'logical-operators', title: 'Logical operators and implicit AND' },
    ],
    exercises: ['range-query', 'match-any-of', 'and-around-an-or'],
  },
  {
    slug: 'nested-and-arrays',
    track: 'fundamentals',
    title: 'Nested objects and arrays',
    summary: 'Dot notation, matching array contents, and the trap everyone hits.',
    goal: 'Query inside sub-documents and arrays of objects correctly.',
    lessons: [
      { slug: 'dot-notation', title: 'Dot notation into nested objects' },
      { slug: 'querying-arrays', title: 'Querying arrays' },
      { slug: 'arrays-of-objects', title: 'Arrays of objects' },
      { slug: 'elemmatch', title: '$elemMatch and the multi-condition trap' },
    ],
    exercises: ['nested-field-match', 'array-contains-value', 'array-contains-all', 'elemmatch-trap'],
  },
  {
    slug: 'sorting-and-paging',
    track: 'fundamentals',
    title: 'Sorting and pagination',
    summary: 'sort(), limit(), skip() — and why skip() stops working at scale.',
    goal: 'Return page N of a sorted result set, and know what that costs.',
    lessons: [
      { slug: 'sorting', title: 'Sorting results' },
      { slug: 'limit-and-skip', title: 'limit(), skip(), and why big skips hurt' },
    ],
    exercises: ['sort-skip-limit'],
  },
  {
    slug: 'updating-documents',
    track: 'fundamentals',
    title: 'Updating documents',
    summary: '$set, $inc, upsert, replaceOne — and the update that silently deletes fields.',
    goal: 'Change existing documents without destroying the parts you did not mean to touch.',
    lessons: [
      { slug: 'update-and-set', title: 'update() and $set' },
      { slug: 'inc', title: '$inc and counters' },
      { slug: 'atomicity', title: 'Atomicity: why $inc beats read-modify-write' },
      { slug: 'updateone-vs-updatemany', title: 'updateOne vs updateMany' },
      { slug: 'replaceone-vs-set', title: 'replaceOne vs $set' },
      { slug: 'upsert', title: 'Upsert: insert or update' },
    ],
    exercises: ['set-nested-field', 'guarded-decrement', 'upsert-a-document'],
  },
  {
    slug: 'updating-arrays',
    track: 'fundamentals',
    title: 'Updating arrays',
    summary: '$push, $addToSet, $pull, and editing an object inside an array.',
    goal: 'Modify array contents in place, without reading the document first.',
    lessons: [
      { slug: 'array-update-operators', title: '$push, $addToSet and $pull' },
      { slug: 'positional-operator', title: 'The positional $ operator' },
    ],
    exercises: ['addtoset-vs-push', 'positional-update', 'pull-from-array'],
  },

  /* ---------- Track B: aggregation ---------- */
  {
    slug: 'aggregation-pipeline',
    track: 'aggregation',
    title: 'The aggregation pipeline',
    summary: 'Stages, order, and reshaping documents with $match and $project.',
    goal: 'Read a pipeline top to bottom and predict the shape at every stage.',
    lessons: [
      { slug: 'find-vs-aggregate', title: 'find() vs aggregate()' },
      { slug: 'what-is-a-pipeline', title: 'What a pipeline actually is' },
      { slug: 'match-stage', title: '$match, and why it goes first' },
      { slug: 'project-stage', title: '$project and computed fields' },
      { slug: 'set-and-addfields', title: '$set and $addFields' },
      { slug: 'sort-limit-skip-stages', title: '$sort, $limit, $skip — order matters' },
    ],
    exercises: ['match-then-sort', 'project-computed-field'],
  },
  {
    slug: 'grouping',
    track: 'aggregation',
    title: 'Grouping and accumulators',
    summary: '$group, $sum, $avg, $min, $max, $first — turning many documents into few.',
    goal: 'Aggregate a collection down to one row per key.',
    lessons: [
      { slug: 'group-stage', title: '$group: the heart of aggregation' },
      { slug: 'group-and-sum', title: 'Counting and summing' },
      { slug: 'accumulators', title: 'The accumulator operators' },
      { slug: 'push-vs-addtoset-in-group', title: '$push vs $addToSet inside $group' },
      { slug: 'compound-group-key', title: 'Grouping by more than one field' },
      { slug: 'first-and-last', title: '$first and $last' },
    ],
    // `average-per-month` looks like a grouping drill but needs $month, which is
    // not taught until the date lesson - so it lives with the other date work.
    exercises: ['count-by-group', 'several-accumulators', 'compound-group-key', 'latest-per-user'],
  },
  {
    slug: 'unwind-arrays',
    track: 'aggregation',
    title: 'Arrays in a pipeline',
    summary: '$unwind: one document per array element, and the pattern it unlocks.',
    goal: 'Aggregate over values buried inside arrays.',
    lessons: [
      { slug: 'the-array-problem', title: 'Why $group cannot see inside arrays' },
      { slug: 'unwind-stage', title: '$unwind' },
      { slug: 'unwind-plus-group', title: '$unwind + $group' },
      { slug: 'revenue-per-product', title: 'Worked example: revenue per product' },
    ],
    exercises: ['revenue-per-product', 'distinct-products-per-status', 'top-customers-by-spend'],
  },

  /* ---------- Track C: advanced aggregation ---------- */
  {
    slug: 'lookup-joins',
    track: 'advanced-aggregation',
    title: 'Joining collections with $lookup',
    summary: 'The basic join, the pipeline form, and what it costs.',
    goal: 'Pull related documents from another collection into your result.',
    lessons: [
      { slug: 'lookup-basics', title: '$lookup, and why it returns an array' },
      { slug: 'unwind-after-lookup', title: '$unwind after $lookup' },
      { slug: 'lookup-with-project', title: 'Trimming the joined document' },
      { slug: 'pipeline-lookup', title: 'Pipeline $lookup with let and $expr' },
      { slug: 'lookup-performance', title: 'What $lookup costs' },
    ],
    exercises: ['lookup-join', 'flatten-a-join', 'pipeline-lookup'],
  },
  {
    slug: 'expression-operators',
    track: 'advanced-aggregation',
    title: 'Array and conditional expressions',
    summary: '$filter, $map, $reduce, $cond, $ifNull — working inside a document, not across documents.',
    goal: 'Transform arrays and handle missing fields without leaving the document.',
    lessons: [
      { slug: 'filter-operator', title: '$filter, and how it differs from $match' },
      { slug: 'map-operator', title: '$map, and how it differs from $unwind' },
      { slug: 'reduce-operator', title: '$reduce' },
      { slug: 'cond-operator', title: '$cond: if / else in a pipeline' },
      { slug: 'ifnull-operator', title: '$ifNull and missing fields' },
      { slug: 'size-and-arrayelemat', title: '$size and $arrayElemAt' },
      { slug: 'avoiding-unwind', title: 'When you do not need $unwind' },
      { slug: 'filter-then-calculate', title: 'Filter an array, then calculate' },
      { slug: 'conditional-aggregation', title: 'The conditional aggregation pattern' },
    ],
    exercises: ['filter-array', 'map-array', 'reduce-array', 'conditional-counting', 'ifnull-default', 'filter-then-calculate'],
  },
  {
    slug: 'facets-and-dates',
    track: 'advanced-aggregation',
    title: 'Facets, dates and full problems',
    summary: '$facet for dashboards and paging, date grouping, and one end-to-end interview problem.',
    goal: 'Answer several questions in one round trip, and finish a real coding-round task.',
    lessons: [
      { slug: 'facet-stage', title: '$facet: several pipelines at once' },
      { slug: 'facet-pagination', title: 'Paging and total count in one query' },
      { slug: 'date-aggregation', title: 'Grouping by date' },
      { slug: 'coding-round-walkthrough', title: 'A full coding-round problem, worked' },
    ],
    exercises: [
      'facet-dashboard',
      'facet-pagination',
      'group-by-month',
      'average-per-month',
      'capstone-top-customers',
    ],
  },
];

// Reference pages built from the summary sections of the notes. Not lessons -
// they teach nothing new - but they are the pages people search for by name.
export const REFERENCES = [
  { slug: 'operator-cheatsheet', title: 'MongoDB operator cheatsheet' },
  { slug: 'how-to-think-about-a-pipeline', title: 'How to think about an aggregation pipeline' },
  { slug: 'common-mistakes', title: 'Common aggregation mistakes' },
  {
    slug: 'operator-comparisons',
    title: '$match vs $filter, $project vs $map, $group vs $reduce',
  },
];

export const TRACK_OF_MODULE = Object.fromEntries(MODULES.map((m) => [m.slug, m.track]));

export const MODULE_OF_EXERCISE = Object.fromEntries(
  MODULES.flatMap((m) => m.exercises.map((id) => [id, m.slug]))
);

export const ALL_LESSONS = MODULES.flatMap((m) =>
  m.lessons.map((l) => ({ ...l, module: m.slug, track: m.track }))
);

/** Exercise ids in curriculum order - the order the practice list renders in. */
export const EXERCISE_ORDER = MODULES.flatMap((m) => m.exercises);

/* ---------- navigation ---------- */

export const trackBySlug = (slug) => TRACKS.find((t) => t.slug === slug);
export const moduleBySlug = (slug) => MODULES.find((m) => m.slug === slug);
export const lessonBySlug = (slug) => ALL_LESSONS.find((l) => l.slug === slug);

/**
 * The lesson before and after this one, walking the whole course rather than
 * stopping at a module boundary - someone reading straight through should not
 * hit a dead end halfway.
 */
export function lessonNeighbours(slug) {
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: ALL_LESSONS[i - 1] ?? null, next: ALL_LESSONS[i + 1] ?? null };
}

export function moduleNeighbours(slug) {
  const i = MODULES.findIndex((m) => m.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: MODULES[i - 1] ?? null, next: MODULES[i + 1] ?? null };
}

export const modulesInTrack = (slug) => MODULES.filter((m) => m.track === slug);

/** Every URL the site publishes, for the sitemap and for link checking. */
export function allPaths() {
  return [
    '/',
    '/learn/',
    '/practice/',
    '/dataset/',
    ...MODULES.map((m) => `/modules/${m.slug}/`),
    ...ALL_LESSONS.map((l) => `/learn/${l.slug}/`),
    ...REFERENCES.map((r) => `/reference/${r.slug}/`),
  ];
}
