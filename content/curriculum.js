// The curriculum: tracks -> modules -> lessons, plus each module's drill queue.
//
// This file is pure data with no imports, so the Astro build, the practice app
// and the test suite all read the same ordering. It is the single source of
// truth for URLs: a lesson's `slug` is its page, a module's `slug` is its hub
// page, and an exercise's `id` is its practice URL.
//
// `source` points at the line range in the original notes a lesson is written
// from. It exists so the extraction is reproducible and reviewable; once a
// lesson has real prose in `content/lessons/`, `source` is only history.

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
      { slug: 'how-mongodb-stores-data', title: 'How MongoDB stores data', source: { file: 'batch1.md', from: 7, to: 49 } },
      { slug: 'find-and-findone', title: 'find() and findOne()', source: { file: 'batch1.md', from: 50, to: 82 } },
      { slug: 'projection', title: 'Projection: choosing fields', source: { file: 'batch1.md', from: 433, to: 503 } },
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
      { slug: 'comparison-operators', title: 'Comparison operators', source: { file: 'batch1.md', from: 83, to: 115 } },
      { slug: 'in-and-nin', title: '$in and $nin', source: { file: 'batch1.md', from: 116, to: 147 } },
      { slug: 'logical-operators', title: 'Logical operators and implicit AND', source: { file: 'batch1.md', from: 148, to: 224 } },
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
      { slug: 'dot-notation', title: 'Dot notation into nested objects', source: { file: 'batch1.md', from: 225, to: 253 } },
      { slug: 'querying-arrays', title: 'Querying arrays', source: { file: 'batch1.md', from: 254, to: 320 } },
      { slug: 'arrays-of-objects', title: 'Arrays of objects', source: { file: 'batch1.md', from: 321, to: 355 } },
      { slug: 'elemmatch', title: '$elemMatch and the multi-condition trap', source: { file: 'batch1.md', from: 356, to: 432 } },
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
      { slug: 'sorting', title: 'Sorting results', source: { file: 'batch1.md', from: 504, to: 536 } },
      { slug: 'limit-and-skip', title: 'limit(), skip(), and why big skips hurt', source: { file: 'batch1.md', from: 537, to: 597 } },
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
      { slug: 'update-and-set', title: 'update() and $set', source: { file: 'batch1.md', from: 598, to: 681 } },
      { slug: 'inc', title: '$inc and counters', source: { file: 'batch1.md', from: 682, to: 718 } },
      { slug: 'atomicity', title: 'Atomicity: why $inc beats read-modify-write', source: { file: 'batch1.md', from: 944, to: 991 } },
      { slug: 'updateone-vs-updatemany', title: 'updateOne vs updateMany', source: { file: 'batch1.md', from: 992, to: 1009 } },
      { slug: 'replaceone-vs-set', title: 'replaceOne vs $set', source: { file: 'batch1.md', from: 1010, to: 1063 } },
      { slug: 'upsert', title: 'Upsert: insert or update', source: { file: 'batch1.md', from: 1064, to: 1100 } },
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
      { slug: 'array-update-operators', title: '$push, $addToSet and $pull', source: { file: 'batch1.md', from: 719, to: 779 } },
      { slug: 'positional-operator', title: 'The positional $ operator', source: { file: 'batch1.md', from: 780, to: 849 } },
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
      { slug: 'find-vs-aggregate', title: 'find() vs aggregate()', source: { file: 'batch1.md', from: 850, to: 943 } },
      { slug: 'what-is-a-pipeline', title: 'What a pipeline actually is', source: { file: 'batch2.md', from: 116, to: 149 } },
      { slug: 'match-stage', title: '$match, and why it goes first', source: { file: 'batch2.md', from: 150, to: 254 } },
      { slug: 'project-stage', title: '$project and computed fields', source: { file: 'batch2.md', from: 255, to: 379 } },
      { slug: 'set-and-addfields', title: '$set and $addFields', source: { file: 'batch2.md', from: 380, to: 433 } },
      { slug: 'sort-limit-skip-stages', title: '$sort, $limit, $skip — order matters', source: { file: 'batch2.md', from: 434, to: 531 } },
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
      { slug: 'group-stage', title: '$group: the heart of aggregation', source: { file: 'batch2.md', from: 532, to: 582 } },
      { slug: 'group-and-sum', title: 'Counting and summing', source: { file: 'batch2.md', from: 583, to: 674 } },
      { slug: 'accumulators', title: 'The accumulator operators', source: { file: 'batch2.md', from: 675, to: 717 } },
      { slug: 'push-vs-addtoset-in-group', title: '$push vs $addToSet inside $group', source: { file: 'batch2.md', from: 718, to: 778 } },
      { slug: 'compound-group-key', title: 'Grouping by more than one field', source: { file: 'batch2.md', from: 1159, to: 1273 } },
      { slug: 'first-and-last', title: '$first and $last', source: { file: 'batch2.md', from: 1274, to: 1319 } },
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
      { slug: 'the-array-problem', title: 'Why $group cannot see inside arrays', source: { file: 'batch2.md', from: 779, to: 838 } },
      { slug: 'unwind-stage', title: '$unwind', source: { file: 'batch2.md', from: 839, to: 922 } },
      { slug: 'unwind-plus-group', title: '$unwind + $group', source: { file: 'batch2.md', from: 923, to: 1071 } },
      { slug: 'revenue-per-product', title: 'Worked example: revenue per product', source: { file: 'batch2.md', from: 1072, to: 1158 } },
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
      { slug: 'lookup-basics', title: '$lookup, and why it returns an array', source: { file: 'batch3.md', from: 24, to: 130 } },
      { slug: 'unwind-after-lookup', title: '$unwind after $lookup', source: { file: 'batch3.md', from: 131, to: 182 } },
      { slug: 'lookup-with-project', title: 'Trimming the joined document', source: { file: 'batch3.md', from: 183, to: 233 } },
      { slug: 'pipeline-lookup', title: 'Pipeline $lookup with let and $expr', source: { file: 'batch3.md', from: 234, to: 363 } },
      { slug: 'lookup-performance', title: 'What $lookup costs', source: { file: 'batch3.md', from: 364, to: 405 } },
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
      { slug: 'filter-operator', title: '$filter, and how it differs from $match', source: { file: 'batch3.md', from: 406, to: 530 } },
      { slug: 'map-operator', title: '$map, and how it differs from $unwind', source: { file: 'batch3.md', from: 531, to: 684 } },
      { slug: 'reduce-operator', title: '$reduce', source: { file: 'batch3.md', from: 685, to: 846 } },
      { slug: 'cond-operator', title: '$cond: if / else in a pipeline', source: { file: 'batch3.md', from: 847, to: 945 } },
      { slug: 'ifnull-operator', title: '$ifNull and missing fields', source: { file: 'batch3.md', from: 946, to: 990 } },
      { slug: 'size-and-arrayelemat', title: '$size and $arrayElemAt', source: { file: 'batch3.md', from: 991, to: 1070 } },
      { slug: 'avoiding-unwind', title: 'When you do not need $unwind', source: { file: 'batch3.md', from: 1528, to: 1607 } },
      { slug: 'filter-then-calculate', title: 'Filter an array, then calculate', source: { file: 'batch3.md', from: 1608, to: 1707 } },
      { slug: 'conditional-aggregation', title: 'The conditional aggregation pattern', source: { file: 'batch3.md', from: 1708, to: 1794 } },
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
      { slug: 'facet-stage', title: '$facet: several pipelines at once', source: { file: 'batch3.md', from: 1071, to: 1194 } },
      { slug: 'facet-pagination', title: 'Paging and total count in one query', source: { file: 'batch3.md', from: 1195, to: 1261 } },
      { slug: 'date-aggregation', title: 'Grouping by date', source: { file: 'batch3.md', from: 1262, to: 1355 } },
      { slug: 'coding-round-walkthrough', title: 'A full coding-round problem, worked', source: { file: 'batch3.md', from: 1356, to: 1527 } },
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
  {
    slug: 'operator-cheatsheet',
    title: 'MongoDB operator cheatsheet',
    source: [
      { file: 'batch1.md', from: 1101, to: 1182 },
      { file: 'batch2.md', from: 1807, to: 1836 },
      { file: 'batch3.md', from: 1865, to: 1991 },
    ],
  },
  {
    slug: 'how-to-think-about-a-pipeline',
    title: 'How to think about an aggregation pipeline',
    source: [
      { file: 'batch2.md', from: 1465, to: 1559 },
      { file: 'batch2.md', from: 1689, to: 1806 },
    ],
  },
  {
    slug: 'common-mistakes',
    title: 'Common aggregation mistakes',
    source: [{ file: 'batch2.md', from: 1560, to: 1688 }],
  },
  {
    slug: 'operator-comparisons',
    title: '$match vs $filter, $project vs $map, $group vs $reduce',
    source: [{ file: 'batch3.md', from: 1795, to: 1864 }],
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
