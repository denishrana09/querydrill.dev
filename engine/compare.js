// Result comparison. Deliberately free of any Node or driver import so that the
// browser bundle and the local server can grade with byte-identical rules - if
// these ever diverged, the hosted site and local mode would disagree about
// whether the same answer is correct.

const MAX_DIFFS = 10;
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

function show(v) {
  if (v === undefined) return '(absent)';
  const s = JSON.stringify(v);
  return s && s.length > 80 ? s.slice(0, 80) + '...' : s;
}

/** Walk two canonical values and collect human-readable field differences. */
function diffValue(actual, expected, path, out) {
  if (out.length >= MAX_DIFFS) return;

  if (typeof actual === 'number' || typeof expected === 'number') {
    if (!numbersEqual(actual, expected)) {
      out.push(`${path}: expected ${show(expected)}, got ${show(actual)}`);
    }
    return;
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.push(`${path}: expected ${show(expected)}, got ${show(actual)}`);
      return;
    }
    if (expected.length !== actual.length) {
      out.push(`${path}: expected an array of ${expected.length}, got ${actual.length}`);
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
        out.push(`${childPath}: missing from your result (expected ${show(expected[k])})`);
      } else if (!(k in expected)) {
        out.push(`${childPath}: your result has an extra field ${show(actual[k])}`);
      } else {
        diffValue(actual[k], expected[k], childPath, out);
      }
      if (out.length >= MAX_DIFFS) return;
    }
    return;
  }

  if (keyOf(actual) !== keyOf(expected)) {
    out.push(`${path}: expected ${show(expected)}, got ${show(actual)}`);
  }
}

/**
 * Compare a result against the reference. Feedback has to be specific -
 * "wrong" teaches nothing, "row Laptop: revenue expected 2000, got 50" does.
 */
export function compare(actualRaw, expectedRaw, { unordered = false, ignore = [] } = {}) {
  // Rows are the elements of a result array, or the single returned document.
  const canonicalTop = (v) =>
    Array.isArray(v) ? v.map((row) => canonical(row, ignore, true)) : canonical(v, ignore, true);

  const actual = canonicalTop(actualRaw);
  const expected = canonicalTop(expectedRaw);

  if (keyOf(actual) === keyOf(expected)) return { pass: true, diffs: [] };

  const diffs = [];

  if (!Array.isArray(expected) || !Array.isArray(actual)) {
    if (Array.isArray(expected) !== Array.isArray(actual)) {
      const want = Array.isArray(expected) ? 'a list of documents' : 'a single value';
      const got = Array.isArray(actual) ? 'a list of documents' : 'a single value';
      diffs.push(`Wrong shape: expected ${want}, got ${got}.`);
      return { pass: false, diffs };
    }
    diffValue(actual, expected, 'result', diffs);
    return { pass: false, diffs };
  }

  if (actual.length !== expected.length) {
    diffs.push(`Wrong number of results: expected ${expected.length}, got ${actual.length}.`);
  }

  // Pair rows by group key when possible - that is what makes a $group diff
  // readable ("row _id=Laptop") instead of positional and confusing.
  const hasIds = (rows) => rows.length > 0 && rows.every((r) => r && typeof r === 'object' && '_id' in r);
  const uniqueIds = (rows) => new Set(rows.map((r) => keyOf(r._id))).size === rows.length;
  const pairById = unordered && hasIds(expected) && hasIds(actual) && uniqueIds(expected) && uniqueIds(actual);

  if (pairById) {
    const actualById = new Map(actual.map((r) => [keyOf(r._id), r]));
    for (const exp of expected) {
      if (diffs.length >= MAX_DIFFS) break;
      const key = keyOf(exp._id);
      const act = actualById.get(key);
      if (!act) {
        diffs.push(`Missing row for _id ${show(exp._id)}.`);
        continue;
      }
      actualById.delete(key);
      diffValue(act, exp, `row _id=${show(exp._id)}`, diffs);
    }
    for (const leftover of actualById.values()) {
      if (diffs.length >= MAX_DIFFS) break;
      diffs.push(`Unexpected extra row for _id ${show(leftover._id)}.`);
    }
  } else if (unordered) {
    const counts = new Map();
    for (const row of expected) counts.set(keyOf(row), (counts.get(keyOf(row)) || 0) + 1);
    const extras = [];
    for (const row of actual) {
      const k = keyOf(row);
      if (counts.get(k) > 0) counts.set(k, counts.get(k) - 1);
      else extras.push(row);
    }
    for (const [k, n] of counts) {
      for (let i = 0; i < n && diffs.length < MAX_DIFFS; i++) {
        diffs.push(`Missing row: ${show(JSON.parse(k))}`);
      }
    }
    for (const row of extras) {
      if (diffs.length >= MAX_DIFFS) break;
      diffs.push(`Unexpected row: ${show(row)}`);
    }
  } else {
    const n = Math.min(actual.length, expected.length);
    for (let i = 0; i < n && diffs.length < MAX_DIFFS; i++) {
      diffValue(actual[i], expected[i], `row ${i}`, diffs);
    }
    if (expected.length > actual.length && diffs.length < MAX_DIFFS) {
      diffs.push(`Missing row ${n}: ${show(expected[n])}`);
    } else if (actual.length > expected.length && diffs.length < MAX_DIFFS) {
      diffs.push(`Unexpected row ${n}: ${show(actual[n])}`);
    }
  }

  // An empty diff list means the two results are equivalent under this
  // exercise's rules - which is the normal case for an `unordered` exercise
  // whose rows simply came back in a different order. Without this, a correct
  // $group answer fails at random depending on row ordering.
  if (!diffs.length) return { pass: true, diffs: [] };

  return { pass: false, diffs: diffs.slice(0, MAX_DIFFS) };
}

