// An in-memory `db` shim backed by mingo, API-compatible with the driver-backed
// shim in server/runner.js. The same user code string must run unchanged on both
// - that is what makes test/conformance.mjs meaningful, and what lets the hosted
// site and the local server share one exercise set.
//
// mingo is synchronous; the driver is not. Everything here returns a promise (or
// a thenable cursor) so user code reads identically in both engines.

// Import both from the package root: that entry point is what registers the
// built-in operators. Importing Query from 'mingo/query' loads the class with
// an empty operator table and every filter fails with 'unknown query operator'.
import { Aggregator, Query } from 'mingo';
// Named, not default: the ESM build has no default export, and Node's CJS
// interop detects these two names fine. A default import builds under Node but
// breaks the browser bundle.
import { updateMany as mingoUpdateMany, updateOne as mingoUpdateOne } from 'mingo/updater';

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : v);

// Kept identical to server/runner.js - see the rationale there.
const FIND_OPTION_KEYS = new Set([
  'projection', 'sort', 'limit', 'skip', 'hint', 'collation', 'batchSize',
  'maxTimeMS', 'maxAwaitTimeMS', 'comment', 'allowDiskUse', 'allowPartialResults',
  'returnKey', 'showRecordId', 'min', 'max', 'noCursorTimeout', 'session',
  'readPreference', 'readConcern', 'let', 'timeoutMS', 'explain', 'tailable',
  'awaitData', 'singleBatch', 'ignoreUndefined', 'raw',
]);

function normalizeFindOptions(second) {
  if (!second || typeof second !== 'object' || Array.isArray(second)) return second;
  if ('projection' in second) return second;

  const keys = Object.keys(second);
  if (!keys.length) return second;

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

/** Chainable + thenable, mirroring CursorShim so `db.users.find({})` resolves to docs. */
class MingoCursor {
  #run;
  #ops = { sort: null, skip: 0, limit: 0, projection: null, collation: null };
  #buf = null;
  #pos = 0;

  constructor(run, projection) {
    this.#run = run;
    this.#ops.projection = projection ?? null;
  }

  sort(spec) { this.#ops.sort = spec; return this; }
  skip(n) { this.#ops.skip = n; return this; }
  limit(n) { this.#ops.limit = n; return this; }
  project(spec) { this.#ops.projection = spec; return this; }
  collation(spec) { this.#ops.collation = spec; return this; }
  hint() { return this; }        // no indexes in browser mode - accept and ignore
  maxTimeMS() { return this; }
  pretty() { return this; }

  toArray() { return Promise.resolve().then(() => this.#run(this.#ops)); }
  count() { return this.toArray().then((d) => d.length); }
  size() { return this.count(); }
  itcount() { return this.count(); }

  explain() {
    return Promise.reject(new Error(
      'explain() needs a real MongoDB server. The local mode (coming soon) supports query plans and indexes.'
    ));
  }

  forEach(fn) { return this.toArray().then((d) => { d.forEach(fn); }); }
  map(fn) { return this.toArray().then((d) => d.map(fn)); }

  async #materialize() {
    if (!this.#buf) { this.#buf = await this.toArray(); this.#pos = 0; }
    return this.#buf;
  }

  async hasNext() { return this.#pos < (await this.#materialize()).length; }
  async next() {
    const docs = await this.#materialize();
    return this.#pos < docs.length ? docs[this.#pos++] : null;
  }

  then(ok, err) { return this.toArray().then(ok, err); }
  catch(err) { return this.toArray().catch(err); }
  finally(fn) { return this.toArray().finally(fn); }
}

function applyCursorOps(cursor, ops) {
  if (ops.collation) cursor = cursor.collation(ops.collation);
  if (ops.sort) cursor = cursor.sort(ops.sort);
  if (ops.skip) cursor = cursor.skip(ops.skip);
  if (ops.limit) cursor = cursor.limit(ops.limit);
  return cursor.all();
}

/** Aggregation has no Cursor, so trailing .sort()/.skip()/.limit() become stages. */
function pipelineWithOps(pipeline, ops) {
  const extra = [];
  if (ops.sort) extra.push({ $sort: ops.sort });
  if (ops.skip) extra.push({ $skip: ops.skip });
  if (ops.limit) extra.push({ $limit: ops.limit });
  if (ops.projection) extra.push({ $project: ops.projection });
  return extra.length ? [...pipeline, ...extra] : pipeline;
}

/**
 * mingo's updater has no upsert, so build the new document the way MongoDB
 * does: seed it from the filter's equality clauses, then apply the modifier.
 * Operator clauses ({ age: { $gt: 20 } }) contribute nothing to the new doc.
 */
function upsert(list, filter, mod, mingoOpts) {
  const seed = {};
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith('$')) continue;
    const isOperatorClause = v && typeof v === 'object' && !Array.isArray(v) &&
      !(v instanceof Date) && Object.keys(v).some((op) => op.startsWith('$'));
    if (!isOperatorClause) seed[k] = v;
  }

  const doc = { ...seed };
  mingoUpdateOne([doc], {}, mod, {}, mingoOpts);
  if (doc._id === undefined) {
    const maxId = list.reduce((m, d) => (typeof d._id === 'number' && d._id > m ? d._id : m), 0);
    doc._id = maxId + 1;
  }
  list.push(doc);
  return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedId: doc._id, upsertedCount: 1 };
}

function makeCollection(store, name, onMutate) {
  const docs = () => (store[name] ??= []);
  const mingoOpts = { collectionResolver: (n) => store[n] ?? [] };
  // Every write goes through ack(), so this is the one place that has to notify.
  const ack = (r) => { onMutate?.(); return Promise.resolve(r); };

  const api = {
    find(filter = {}, options = undefined) {
      const opts = normalizeFindOptions(options) || {};
      const cur = new MingoCursor((ops) => {
        const q = new Query(filter, mingoOpts);
        return applyCursorOps(q.find(docs(), ops.projection ?? undefined), ops);
      }, opts.projection);
      if (opts.sort) cur.sort(opts.sort);
      if (opts.skip) cur.skip(opts.skip);
      if (opts.limit) cur.limit(opts.limit);
      return cur;
    },

    findOne(filter = {}, options = undefined) {
      return api.find(filter, options).limit(1).toArray().then((d) => d[0] ?? null);
    },

    aggregate(pipeline = [], options = undefined) {
      return new MingoCursor((ops) =>
        new Aggregator(pipelineWithOps(pipeline, ops), { ...mingoOpts, ...options }).run(docs()));
    },

    countDocuments(filter = {}) {
      return Promise.resolve(new Query(filter, mingoOpts).find(docs()).all().length);
    },
    estimatedDocumentCount() { return Promise.resolve(docs().length); },
    count(filter = {}) { return api.countDocuments(filter); },

    distinct(field, filter = {}) {
      const matched = new Query(filter, mingoOpts).find(docs()).all();
      const seen = new Map();
      const add = (v) => {
        const k = JSON.stringify(v ?? null);
        if (!seen.has(k)) seen.set(k, v);
      };
      for (const d of matched) {
        const v = field.split('.').reduce((o, p) => (o == null ? o : o[p]), d);
        if (Array.isArray(v)) v.forEach(add); else add(v);
      }
      return Promise.resolve([...seen.values()].sort((a, b) =>
        (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)));
    },

    insertOne(doc) {
      docs().push(clone(doc));
      return ack({ acknowledged: true, insertedId: doc._id });
    },
    insertMany(arr) {
      for (const d of arr) docs().push(clone(d));
      return ack({ acknowledged: true, insertedCount: arr.length });
    },

    updateOne(filter, mod, options = {}) {
      const r = mingoUpdateOne(docs(), filter, mod, {}, mingoOpts);
      if (!r.matchedCount && options.upsert) return ack(upsert(docs(), filter, mod, mingoOpts));
      return ack({ acknowledged: true, matchedCount: r.matchedCount, modifiedCount: r.modifiedCount });
    },
    updateMany(filter, mod, options = {}) {
      const r = mingoUpdateMany(docs(), filter, mod, {}, mingoOpts);
      if (!r.matchedCount && options.upsert) return ack(upsert(docs(), filter, mod, mingoOpts));
      return ack({ acknowledged: true, matchedCount: r.matchedCount, modifiedCount: r.modifiedCount });
    },

    deleteOne(filter = {}) {
      const list = docs();
      const q = new Query(filter, mingoOpts);
      const i = list.findIndex((d) => q.test(d));
      if (i >= 0) list.splice(i, 1);
      return ack({ acknowledged: true, deletedCount: i >= 0 ? 1 : 0 });
    },
    deleteMany(filter = {}) {
      const list = docs();
      const q = new Query(filter, mingoOpts);
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        if (q.test(list[i])) { list.splice(i, 1); n++; }
      }
      return ack({ acknowledged: true, deletedCount: n });
    },

    drop() { delete store[name]; return ack(true); },
    indexes() { return Promise.resolve([{ v: 2, key: { _id: 1 }, name: '_id_' }]); },
    getIndexes() { return api.indexes(); },
    getName: () => name,
    toString: () => name,
  };

  // These need a real server; a clear message beats "not a function".
  for (const unsupported of ['createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'stats']) {
    api[unsupported] = () => Promise.reject(new Error(
      unsupported + '() needs a real MongoDB server. The local mode (coming soon) supports indexes and stats.'
    ));
  }

  return api;
}

/** Build the `db` object handed to user code. `store` is { collectionName: docs[] }. */
export function makeMingoDb(store, dbName = 'practice', { onMutate } = {}) {
  const cache = new Map();
  const collectionFor = (name) => {
    if (!cache.has(name)) cache.set(name, makeCollection(store, name, onMutate));
    return cache.get(name);
  };

  const helpers = {
    getCollection: collectionFor,
    getCollectionNames: () => Promise.resolve(Object.keys(store).sort()),
    getName: () => dbName,
    databaseName: dbName,
    toString: () => dbName,
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
