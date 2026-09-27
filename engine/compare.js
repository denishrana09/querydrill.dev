// Result comparison. Deliberately free of any Node or driver import so that the
// browser bundle and the local server can grade with byte-identical rules - if
// these ever diverged, the hosted site and local mode would disagree about
// whether the same answer is correct.

// How many difference lines a learner is shown. The rest are counted rather than
// printed, because one mistake told ten times is still one mistake: submitting
// the starter on a $group drill used to answer with ten lines of
// `row 0.createdAt: your result has an extra field`, which pushed the only line
// that helped - "expected 11, got 200" - off the top.
const SHOW_DIFFS = 6;

// Above this, a run of the same complaint becomes one sentence with an example.
// Two missing rows are worth printing; eighteen are one fact.
const LIST_UP_TO = 2;

// Field names in one message before it turns into a count.
const MAX_NAMES = 8;

const EPSILON = 1e-9;

/**
 * Strip ignored fields and reduce BSON values to comparable primitives.
 *
 * `isRow` matters: an exercise saying ignore:['_id'] means the row's own _id,
 * NOT every nested _id. Stripping at all depths would quietly delete the
 * embedded orders' _ids too and let a wrong answer pass.
 */
function canonical(value, ignore = [], isRow = false) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { __date: value.toISOString() };
  if (Array.isArray(value)) return value.map((v) => canonical(v, ignore, false));

  if (typeof value === 'object') {
    // ObjectId, Decimal128, Long and friends all stringify meaningfully.
    const ctor = value.constructor?.name;
    if (ctor === 'ObjectId' || ctor === 'Decimal128' || ctor === 'Binary') {
      return { ['__' + ctor.toLowerCase()]: value.toString() };
    }
    if (ctor === 'Long' || ctor === 'Int32' || ctor === 'Double') return Number(value);

    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (isRow && ignore.includes(key)) continue;
      out[key] = canonical(value[key], ignore, false);
    }
    return out;
  }
  return value;
}

const keyOf = (v) => JSON.stringify(v);

function numbersEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** `{__date: ...}`, `{__objectid: ...}` - one value made comparable, not a document. */
const isWrapper = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === 1 && Object.keys(v)[0].startsWith('__');

/**
 * Undo the canonical wrappers for display. `{__date: "..."}` is how a Date is
 * made comparable, not something the learner typed, and feedback naming a field
 * called `__date` sends them looking through their query for it.
 */
function readable(v) {
  if (Array.isArray(v)) return v.map(readable);
  if (v !== null && typeof v === 'object') {
    if (isWrapper(v)) return v[Object.keys(v)[0]];
    const out = {};
    for (const k of Object.keys(v)) out[k] = readable(v[k]);
    return out;
  }
  return v;
}

function show(v) {
  if (v === undefined) return '(absent)';
  const s = JSON.stringify(readable(v));
  return s && s.length > 80 ? s.slice(0, 80) + '...' : s;
}

/**
 * Collects differences, keeps the first few, and counts the rest.
 *
 * The count is what makes truncation honest. Cutting the list at ten and saying
 * nothing left a learner unable to tell "these are your ten mistakes" from
 * "these are ten of your two hundred mistakes", which are different problems
 * with different fixes. It is returned as `hidden` rather than appended to the
 * list, because "5 more not shown" is not itself a difference and should not be
 * rendered as one.
 */
function collector(limit = SHOW_DIFFS) {
  return {
    lines: [],
    total: 0,
    add(line) {
      this.total++;
      if (this.lines.length < limit) this.lines.push(line);
    },
    hidden() {
      return this.total - this.lines.length;
    },
  };
}

/** Walk two canonical values and collect human-readable field differences. */
function diffValue(actual, expected, path, out) {
  if (typeof actual === 'number' || typeof expected === 'number') {
    if (!numbersEqual(actual, expected)) {
      out.add(`${path}: expected ${show(expected)}, got ${show(actual)}`);
    }
    return;
  }

  // A canonical wrapper is one value, not an object with a field in it. Walking
  // into it produced paths like `row 0.createdAt.__date`, which names a field
  // that exists nowhere in the data.
  if (isWrapper(expected) || isWrapper(actual)) {
    if (keyOf(actual) !== keyOf(expected)) {
      out.add(`${path}: expected ${show(expected)}, got ${show(actual)}`);
    }
    return;
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.add(`${path}: expected ${show(expected)}, got ${show(actual)}`);
      return;
    }
    if (expected.length !== actual.length) {
      out.add(`${path}: expected an array of ${expected.length}, got ${actual.length}`);
      return;
    }
    for (let i = 0; i < expected.length; i++) diffValue(actual[i], expected[i], `${path}[${i}]`, out);
    return;
  }

  const bothObjects =
    expected && actual && typeof expected === 'object' && typeof actual === 'object';

  if (bothObjects) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const k of keys) {
      const childPath = path ? `${path}.${k}` : k;
      if (!(k in actual)) {
        out.add(`${childPath}: missing from your result (expected ${show(expected[k])})`);
      } else if (!(k in expected)) {
        out.add(`${childPath}: your result has an extra field ${show(actual[k])}`);
      } else {
        diffValue(actual[k], expected[k], childPath, out);
      }
    }
    return;
  }

  if (keyOf(actual) !== keyOf(expected)) {
    out.add(`${path}: expected ${show(expected)}, got ${show(actual)}`);
  }
}

const isDoc = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const allDocs = (rows) => rows.length > 0 && rows.every(isDoc);

function fieldsOf(rows) {
  const seen = new Set();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen].sort();
}

/** Field names for a message: all of them while they are few, a count after. */
function names(list) {
  if (list.length <= MAX_NAMES) return list.join(', ');
  return `${list.slice(0, MAX_NAMES).join(', ')} and ${list.length - MAX_NAMES} more`;
}

/**
 * True when two rows have nothing in common - a different document, rather than
 * the right document with a wrong field in it. Asked per top-level field, and
 * through diffValue so that two numbers within EPSILON count as the same.
 */
function entirelyDifferent(actual, expected) {
  if (!isDoc(actual) || !isDoc(expected)) return false;
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
  if (keys.length < 2) return false;      // one field differing is just that field
  return keys.every((key) => {
    const probe = collector(0);
    diffValue(actual[key], expected[key], key, probe);
    return probe.total > 0;
  });
}

/** Diff one row, saying "this is a different row" once when that is the case. */
function diffRow(actual, expected, path, out) {
  if (entirelyDifferent(actual, expected)) {
    out.add(`${path}: expected ${show(expected)}, got ${show(actual)}`);
    return;
  }
  diffValue(actual, expected, path, out);
}

/**
 * Report a set of rows that are present on one side only. Under `LIST_UP_TO`
 * they are printed; above it they become one sentence with an example, because
 * the eighteenth missing row teaches nothing the first one did not.
 */
function addRows(out, rows, one, many) {
  if (!rows.length) return;
  if (rows.length <= LIST_UP_TO) {
    for (const row of rows) out.add(one(row));
    return;
  }
  // Counted as a single difference on purpose: the sentence already says how
  // many there are, so adding them to the hidden count would contradict it.
  out.add(many(rows.length, rows[0]));
}

/**
 * Compare two lists of rows. Differences land in `out`.
 *
 * Rows that are present on one side only are reported before field values are
 * compared at all. A missing row is a bigger fact than a wrong number inside a
 * row that is at least there, and with a display limit the bigger fact has to
 * come first or it does not appear.
 */
function diffRows(actual, expected, unordered, out) {
  if (actual.length !== expected.length) {
    out.add(`Wrong number of results: expected ${expected.length}, got ${actual.length}.`);
  }

  // One wrong shape is one mistake. When the rows are not the same kind of
  // document at all - raw orders where grouped totals were asked for - every
  // field of every row differs, so say it once and stop. Nothing below could be
  // compared anyway: there are no shared fields to hold values against.
  if (allDocs(expected) && allDocs(actual)) {
    const want = fieldsOf(expected);
    const got = fieldsOf(actual);
    const missing = want.filter((f) => !got.includes(f));
    const extra = got.filter((f) => !want.includes(f));

    if (missing.length) {
      out.add(
        'Your rows have the wrong fields, so nothing else is compared: ' +
        `expected ${names(want)}; got ${names(got)}.`
      );
      return;
    }
    if (extra.length) {
      // Every expected field is present, so the values are still worth
      // comparing - but the extras are said here rather than once per row.
      // Rows are then quoted in their stripped form, which is what makes
      // "your row is not in the answer" about the filter and not about the
      // projection that was already reported on the line above.
      out.add(`Your rows have extra fields: ${names(extra)}. Expected only ${names(want)}.`);
      actual = actual.map((row) => {
        const kept = {};
        for (const key of Object.keys(row)) if (!extra.includes(key)) kept[key] = row[key];
        return kept;
      });
    }
  }

  // Pair rows by group key when possible - that is what makes a $group diff
  // readable ("row _id=Laptop") instead of positional and confusing.
  const hasIds = (rows) => rows.length > 0 && rows.every((r) => isDoc(r) && '_id' in r);
  const uniqueIds = (rows) => new Set(rows.map((r) => keyOf(r._id))).size === rows.length;
  const pairById = unordered && hasIds(expected) && hasIds(actual) && uniqueIds(expected) && uniqueIds(actual);

  if (pairById) {
    const actualById = new Map(actual.map((r) => [keyOf(r._id), r]));
    const pairs = [];
    const missingRows = [];
    for (const exp of expected) {
      const key = keyOf(exp._id);
      const act = actualById.get(key);
      if (act) {
        pairs.push([act, exp]);
        actualById.delete(key);
      } else {
        missingRows.push(exp);
      }
    }
    addRows(out, missingRows,
      (r) => `Missing row for _id ${show(r._id)}.`,
      (n, r) => `${n} expected rows are missing, including _id ${show(r._id)}.`);
    addRows(out, [...actualById.values()],
      (r) => `Unexpected extra row for _id ${show(r._id)}.`,
      (n, r) => `${n} of your rows are not in the answer, including _id ${show(r._id)}.`);
    for (const [act, exp] of pairs) diffValue(act, exp, `row _id=${show(exp._id)}`, out);
    return;
  }

  if (unordered) {
    const counts = new Map();
    for (const row of expected) counts.set(keyOf(row), (counts.get(keyOf(row)) || 0) + 1);
    const extras = [];
    for (const row of actual) {
      const k = keyOf(row);
      if (counts.get(k) > 0) counts.set(k, counts.get(k) - 1);
      else extras.push(row);
    }
    const missingRows = [];
    for (const [k, n] of counts) {
      for (let i = 0; i < n; i++) missingRows.push(JSON.parse(k));
    }
    addRows(out, missingRows,
      (r) => `Missing row: ${show(r)}`,
      (n, r) => `${n} expected rows are missing, e.g. ${show(r)}`);
    addRows(out, extras,
      (r) => `Unexpected row: ${show(r)}`,
      (n, r) => `${n} of your rows are not in the answer, e.g. ${show(r)}`);
    return;
  }

  const n = Math.min(actual.length, expected.length);
  if (expected.length > actual.length) {
    addRows(out, expected.slice(n),
      (r) => `Missing row: ${show(r)}`,
      (m, r) => `${m} expected rows are missing, starting with ${show(r)}`);
  } else if (actual.length > expected.length) {
    addRows(out, actual.slice(n),
      (r) => `Unexpected row: ${show(r)}`,
      (m, r) => `${m} of your rows are extra, starting with ${show(r)}`);
  }
  // Every position holding a different document is one fact - the sort or the
  // filter is wrong - and it is the normal result of submitting the starter on a
  // sort drill. Enumerating the fields of row 0 says it once per field.
  const paired = Array.from({ length: n }, (_, i) => i);
  if (n > 1 && paired.every((i) => entirelyDifferent(actual[i], expected[i]))) {
    out.add(
      'No row matches the expected one at the same position: ' +
      `row 0 is ${show(actual[0])}, expected ${show(expected[0])}.`
    );
    return;
  }
  for (let i = 0; i < n; i++) diffRow(actual[i], expected[i], `row ${i}`, out);
}

/**
 * Compare a result against the reference. Feedback has to be specific -
 * "wrong" teaches nothing, "row Laptop: revenue expected 2000, got 50" does -
 * and it has to be short enough to read, which is a different constraint and
 * the reason differences are grouped rather than enumerated.
 */
export function compare(actualRaw, expectedRaw, { unordered = false, ignore = [] } = {}) {
  // Rows are the elements of a result array, or the single returned document.
  const canonicalTop = (v) =>
    Array.isArray(v) ? v.map((row) => canonical(row, ignore, true)) : canonical(v, ignore, true);

  const actual = canonicalTop(actualRaw);
  const expected = canonicalTop(expectedRaw);

  if (keyOf(actual) === keyOf(expected)) return { pass: true, diffs: [], hidden: 0 };

  const diffs = collector();

  if (!Array.isArray(expected) || !Array.isArray(actual)) {
    if (Array.isArray(expected) !== Array.isArray(actual)) {
      const want = Array.isArray(expected) ? 'a list of documents' : 'a single value';
      const got = Array.isArray(actual) ? 'a list of documents' : 'a single value';
      diffs.add(`Wrong shape: expected ${want}, got ${got}.`);
    } else {
      diffValue(actual, expected, 'result', diffs);
    }
  } else {
    diffRows(actual, expected, unordered, diffs);
  }

  // No differences means the two results are equivalent under this exercise's
  // rules, even though their JSON is not identical - an `unordered` exercise
  // whose rows came back in a different order, or two numbers within EPSILON.
  // Without this, a correct $group answer fails at random depending on ordering.
  if (!diffs.total) return { pass: true, diffs: [], hidden: 0 };

  return { pass: false, diffs: diffs.lines, hidden: diffs.hidden() };
}
