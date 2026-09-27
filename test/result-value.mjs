// Why a query result is not worth putting in front of a learner - or '' if it is.
//
// Shared by test/examples.mjs, which runs the examples on lesson pages, and
// test/browser-grade.mjs, which runs every drill's reference solution. Both need
// the same rule and must not drift apart on what "returns nothing" means.
//
// The failure this exists for is the one that survives review: code that parses,
// runs, throws nothing, and returns `[]`. On a lesson the reader presses Run,
// sees nothing, and concludes the site is broken. On a drill it is worse - the
// grader compares the learner's result against the reference solution, so an
// empty expected answer means an empty answer *passes*. They type the right
// query, see nothing, and cannot tell whether they got it right.

/**
 * @param {unknown} value a query result
 * @returns {string} why it is not worth showing, or '' when it is fine
 */
export function whyUseless(value) {
  if (value === undefined) return 'returned undefined - needs an explicit `return`';
  if (value === null) return 'returned null - the filter matches nothing in the dataset';
  if (Array.isArray(value)) {
    return value.length ? '' : 'returned [] - the filter matches nothing in the dataset';
  }
  if (value && typeof value === 'object' && 'acknowledged' in value) {
    // An upsert that inserted counts, even though it matched nothing.
    const touched = (value.matchedCount ?? 0) + (value.insertedCount ?? 0) +
      (value.deletedCount ?? 0) + (value.upsertedCount ?? 0) + (value.insertedId != null ? 1 : 0);
    return touched ? '' : `the write touched nothing: ${JSON.stringify(value)}`;
  }
  return '';
}
