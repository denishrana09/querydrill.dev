// Exercise ids used to be `b1-01` style. They are now URL slugs, because an id
// is a permalink and a localStorage key at the same time.
//
// This map exists so anyone who practised before the rename keeps their solved
// marks and their drafts. It is applied once, on load, and then the old keys are
// dropped. Safe to delete a few months after launch - the only cost of deleting
// it early is that early users silently lose their progress.

export const LEGACY_IDS = {
  'b1-01': 'find-with-projection',
  'b1-02': 'range-query',
  'b1-03': 'match-any-of',
  'b1-04': 'nested-field-match',
  'b1-05': 'array-contains-value',
  'b1-06': 'array-contains-all',
  'b1-07': 'elemmatch-trap',
  'b1-08': 'and-around-an-or',
  'b1-09': 'sort-skip-limit',
  'b1-10': 'set-nested-field',
  'b1-11': 'guarded-decrement',
  'b1-12': 'addtoset-vs-push',
  'b1-13': 'positional-update',
  'b1-14': 'upsert-a-document',
  'b1-15': 'pull-from-array',
  'b2-01': 'match-then-sort',
  'b2-02': 'project-computed-field',
  'b2-03': 'count-by-group',
  'b2-04': 'several-accumulators',
  'b2-05': 'revenue-per-product',
  'b2-06': 'distinct-products-per-status',
  'b2-07': 'top-customers-by-spend',
  'b2-08': 'compound-group-key',
  'b2-09': 'latest-per-user',
  'b2-10': 'average-per-month',
  'b3-01': 'lookup-join',
  'b3-02': 'flatten-a-join',
  'b3-03': 'pipeline-lookup',
  'b3-04': 'filter-array',
  'b3-05': 'map-array',
  'b3-06': 'reduce-array',
  'b3-07': 'conditional-counting',
  'b3-08': 'ifnull-default',
  'b3-09': 'facet-dashboard',
  'b3-10': 'facet-pagination',
  'b3-11': 'group-by-month',
  'b3-12': 'filter-then-calculate',
  'b3-13': 'capstone-top-customers',
};

/**
 * Rewrite `b1-01` keys to slugs. Returns a new object; an existing slug key
 * always wins, so re-running this can never clobber newer work.
 */
export function migrateKeys(stored) {
  if (!stored || typeof stored !== 'object') return stored;

  const legacy = Object.keys(stored).filter((k) => k in LEGACY_IDS);
  if (!legacy.length) return stored;

  // Current keys are copied first so they win outright: a legacy key can only
  // fill a slot nothing has claimed.
  const out = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!(key in LEGACY_IDS)) out[key] = value;
  }
  for (const key of legacy) {
    const slug = LEGACY_IDS[key];
    if (!(slug in out)) out[slug] = stored[key];
  }
  return out;
}
