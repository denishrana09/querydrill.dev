import vm from 'node:vm';
import mongodb from 'mongodb';

// mongodb v6 is CommonJS, so these are not reliably detected as named ESM
// exports - destructure from the default export instead.
const { EJSON, ObjectId, Int32, Long, Decimal128, Double, Binary, Timestamp } = mongodb.BSON;

export const RESULT_CAP = 200;
const SYNC_TIMEOUT_MS = 5000;   // catches `while (true) {}`
const TOTAL_TIMEOUT_MS = 15000; // catches a slow / unindexed query

/**
 * A chainable, *thenable* cursor.
 *
 * The `then` is the whole point: it lets you write
 *
 *     db.orders.find({ status: "completed" })
 *
 * and get documents back, exactly like the mongo shell, with no trailing
 * `.toArray()`. Without it every exercise answer would need `.toArray()` and
 * the muscle memory built here would be the wrong one.
 */
class CursorShim {
  #make;
  #ops = [];
  #docs = null;
  #pos = 0;

  constructor(make) {
    this.#make = make;
  }

  #op(name, args) {
    this.#ops.push([name, args]);
    return this;
  }

  sort(...a) { return this.#op('sort', a); }
  limit(...a) { return this.#op('limit', a); }
  skip(...a) { return this.#op('skip', a); }
  project(...a) { return this.#op('project', a); }
  hint(...a) { return this.#op('hint', a); }
  collation(...a) { return this.#op('collation', a); }
  maxTimeMS(...a) { return this.#op('maxTimeMS', a); }

  #build() {
    let cursor = this.#make();
    for (const [name, args] of this.#ops) {
      if (typeof cursor[name] !== 'function') {
        throw new Error(
          '.' + name + '() is not available on this cursor. ' +
          'For an aggregation, use a $' + name + ' stage in the pipeline instead.'
        );
      }
      cursor = cursor[name](...args);
    }
    return cursor;
  }

  toArray() { return this.#build().toArray(); }
  count() { return this.#build().toArray().then((d) => d.length); }
  size() { return this.count(); }
  itcount() { return this.count(); }
  explain(verbosity = 'executionStats') { return this.#build().explain(verbosity); }

  // The results pane already formats output, so pretty() is a no-op - but it
  // has to exist, because typing it is pure shell muscle memory.
  pretty() { return this; }

  forEach(fn) { return this.toArray().then((docs) => { docs.forEach(fn); }); }
  map(fn) { return this.toArray().then((docs) => docs.map(fn)); }

  async #materialize() {
    if (!this.#docs) {
      this.#docs = await this.toArray();
      this.#pos = 0;
    }
    return this.#docs;
  }

  async hasNext() { return this.#pos < (await this.#materialize()).length; }
  async next() {
    const docs = await this.#materialize();
    return this.#pos < docs.length ? docs[this.#pos++] : null;
  }

  then(onOk, onErr) { return this.toArray().then(onOk, onErr); }
  catch(onErr) { return this.toArray().catch(onErr); }
  finally(fn) { return this.toArray().finally(fn); }
}

// Real FindOptions keys, used to tell a driver options object apart from a
// shell-style projection document.
const FIND_OPTION_KEYS = new Set([
  'projection', 'sort', 'limit', 'skip', 'hint', 'collation', 'batchSize',
  'maxTimeMS', 'maxAwaitTimeMS', 'comment', 'allowDiskUse', 'allowPartialResults',
  'returnKey', 'showRecordId', 'min', 'max', 'noCursorTimeout', 'session',
  'readPreference', 'readConcern', 'let', 'timeoutMS', 'explain', 'tailable',
  'awaitData', 'singleBatch', 'ignoreUndefined', 'raw',
]);

/**
 * In the mongo shell the second argument to find() IS the projection:
 *
 *     db.users.find({ status: "active" }, { name: 1, email: 1, _id: 0 })
 *
 * The Node driver instead expects an options object with a `projection` key.
 * The notes teach the shell form and interviews expect it, so accept both and
 * translate - otherwise this playground would drill the wrong habit.
 */
function normalizeFindOptions(second) {
  if (!second || typeof second !== 'object' || Array.isArray(second)) return second;
  if ('projection' in second) return second; // already driver-style

  const keys = Object.keys(second);
  if (!keys.length) return second;

  // 1/0/true/false values, or a projection operator like { $slice: 2 },
  // mean this is a projection - even for a field named e.g. "limit".
  const looksLikeProjection = keys.every((k) => {
    const v = second[k];
    if (v === 0 || v === 1 || v === true || v === false) return true;
    return Boolean(v) && typeof v === 'object' &&
      Object.keys(v).some((op) => op.startsWith('$'));
  });
  if (looksLikeProjection) return { projection: second };

  if (keys.every((k) => FIND_OPTION_KEYS.has(k))) return second;
  return { projection: second };
}

const PASSTHROUGH = [
  'countDocuments', 'estimatedDocumentCount', 'distinct',
  'insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne',
  'deleteOne', 'deleteMany', 'bulkWrite', 'findOneAndUpdate',
  'findOneAndReplace', 'findOneAndDelete', 'createIndex', 'createIndexes',
  'dropIndex', 'dropIndexes', 'drop', 'rename',
];

function makeCollectionShim(collection, db) {
  const shim = {
    // Collection.stats() was removed in driver v6 - run the command instead.
    stats: () => db.command({ collStats: collection.collectionName }),
    find: (filter = {}, options = undefined) =>
      new CursorShim(() => collection.find(filter, normalizeFindOptions(options))),
    findOne: (filter = {}, options = undefined) =>
      collection.findOne(filter, normalizeFindOptions(options)),
    aggregate: (pipeline = [], options = undefined) =>
      new CursorShim(() => collection.aggregate(pipeline, options)),
    indexes: () => collection.indexes(),
    getIndexes: () => collection.indexes(),
    count: (filter = {}) => collection.countDocuments(filter),
    getName: () => collection.collectionName,
    toString: () => collection.collectionName,
  };
  for (const name of PASSTHROUGH) {
    shim[name] = (...args) => collection[name](...args);
  }
  return shim;
}

function makeDbShim(db) {
  const cache = new Map();
  const collectionFor = (name) => {
    if (!cache.has(name)) cache.set(name, makeCollectionShim(db.collection(name), db));
    return cache.get(name);
  };

  const helpers = {
    getCollection: collectionFor,
    getCollectionNames: () =>
      db.listCollections({}, { nameOnly: true }).toArray().then((c) => c.map((x) => x.name).sort()),
    getName: () => db.databaseName,
    stats: () => db.stats(),
    runCommand: (cmd) => db.command(cmd),
    dropDatabase: () => db.dropDatabase(),
    toString: () => db.databaseName,
  };

  return new Proxy(helpers, {
    get(target, prop) {
      // `then` must stay undefined, or `await db` would treat the proxy as a
      // thenable and hand JS a collection shim named "then".
      if (typeof prop !== 'string' || prop === 'then' || prop === 'inspect') return undefined;
      if (prop in target) return target[prop];
      return collectionFor(prop);
    },
    has: () => true,
  });
}

function safeStringify(value) {
  try {
    return EJSON.stringify(value, { relaxed: true });
  } catch {
    return String(value);
  }
}

function buildSandbox(db, logs) {
  const capture = (...args) => {
    logs.push(args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' '));
  };
  return {
    db: makeDbShim(db),
    // Plain functions, not arrows or bare classes: the shell writes
    // ObjectId("...") with no `new`, but people also type `new ObjectId(...)`.
    // A function that returns an object supports both call styles.
    ObjectId: function (v) { return new ObjectId(v); },
    ISODate: function (v) { return v === undefined ? new Date() : new Date(v); },
    Date,
    NumberInt: function (v) { return new Int32(v); },
    NumberLong: function (v) { return Long.fromValue(v); },
    NumberDecimal: function (v) { return Decimal128.fromString(String(v)); },
    NumberDouble: function (v) { return new Double(v); },
    Binary: function (...a) { return new Binary(...a); },
    Timestamp: function (...a) { return new Timestamp(...a); },
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Promise,
    print: capture,
    printjson: capture,
    console: { log: capture, error: capture, warn: capture, info: capture },
  };
}

/**
 * Compile shell-style: a bare expression is the result. Falls back to
 * statement mode, where an explicit `return` is required.
 */
function compile(code) {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Nothing to run.');

  // `db.users.find({});` is one expression to a human. Without stripping that
  // semicolon it fails expression mode, falls through to statement mode, and
  // silently returns nothing at all.
  const asExpression = trimmed.replace(/;+\s*$/, '');

  try {
    return new vm.Script('(async () => { return (\n' + asExpression + '\n); })()');
  } catch {
    try {
      return new vm.Script('(async () => {\n' + trimmed + '\n})()');
    } catch (err) {
      throw new Error('Syntax error: ' + err.message);
    }
  }
}

/**
 * Run a snippet of user code against `db` and return plain, serialisable data.
 */
export async function runCode(db, code, { cap = RESULT_CAP } = {}) {
  const logs = [];
  const started = process.hrtime.bigint();
  const elapsed = () => Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10;

  try {
    const script = compile(code);
    const context = vm.createContext(buildSandbox(db, logs));
    const promise = script.runInContext(context, { timeout: SYNC_TIMEOUT_MS });

    let timer;
    const value = await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Timed out after ' + TOTAL_TIMEOUT_MS / 1000 + 's.')),
          TOTAL_TIMEOUT_MS
        );
      }),
    ]).finally(() => clearTimeout(timer));

    let out = value;
    let truncated = false;
    let totalRows = null;

    if (Array.isArray(value)) {
      totalRows = value.length;
      if (value.length > cap) {
        out = value.slice(0, cap);
        truncated = true;
      }
    }

    return {
      ok: true,
      ejson: EJSON.stringify(out === undefined ? null : out, { relaxed: true }),
      logs,
      ms: elapsed(),
      truncated,
      totalRows,
      isUndefined: value === undefined,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), logs, ms: elapsed() };
  }
}

/** Shared EJSON encoding, so every pane renders BSON the same way. */
export function toEJSON(value) {
  return EJSON.stringify(value === undefined ? null : value, { relaxed: true });
}

/** Same execution path, but returns the raw value and throws on failure. */
export async function runOrThrow(db, code) {
  const logs = [];
  const script = compile(code);
  const context = vm.createContext(buildSandbox(db, logs));
  const promise = script.runInContext(context, { timeout: SYNC_TIMEOUT_MS });

  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out.')), TOTAL_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}
