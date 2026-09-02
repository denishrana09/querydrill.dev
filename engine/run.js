// Browser-safe counterpart to server/runner.js.
//
// The server uses node:vm, which does not exist in a browser. `new Function` +
// `with` gives the same thing that matters here: a bare expression evaluated
// against a sandbox object, so `db.users.find({})` is a complete program. The
// function body is sloppy mode, which is what makes `with` legal.
//
// There is no security boundary here and none is needed - this runs in the
// user's own tab against their own in-memory data, exactly like the devtools
// console. That is the whole reason browser mode is safe to host.

const TIMEOUT_MS = 15000;

/** Minimal stand-ins for the shell globals. The bundled datasets use plain
 *  numeric _ids, so no real BSON codec is pulled into the browser bundle. */
function shellGlobals(capture) {
  class ObjectIdish {
    constructor(v) { this.value = String(v ?? ''); }
    toString() { return this.value; }
    toJSON() { return this.value; }
  }
  return {
    ObjectId: function (v) { return new ObjectIdish(v); },
    ISODate: function (v) { return v === undefined ? new Date() : new Date(v); },
    NumberInt: function (v) { return Math.trunc(Number(v)); },
    NumberLong: function (v) { return Number(v); },
    NumberDouble: function (v) { return Number(v); },
    NumberDecimal: function (v) { return Number(v); },
    Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Promise,
    print: capture,
    printjson: capture,
    console: { log: capture, error: capture, warn: capture, info: capture },
  };
}

/**
 * Compile shell-style: a bare expression is the result. Falls back to statement
 * mode, where an explicit `return` is required. Mirrors compile() in
 * server/runner.js, including the trailing-semicolon strip.
 */
function compile(code) {
  const trimmed = code.trim();
  if (!trimmed) throw new Error('Nothing to run.');

  const asExpression = trimmed.replace(/;+\s*$/, '');
  const wrap = (body) =>
    new Function('__sandbox', 'with (__sandbox) { return (async () => {\n' + body + '\n})(); }');

  try {
    return wrap('return (\n' + asExpression + '\n);');
  } catch {
    try {
      return wrap(trimmed);
    } catch (err) {
      throw new Error('Syntax error: ' + err.message);
    }
  }
}

/** Run user code against `db`. Returns the raw value and throws on failure. */
export async function runOrThrow(db, code) {
  const logs = [];
  const capture = (...a) => logs.push(a.map((x) =>
    typeof x === 'string' ? x : JSON.stringify(x)).join(' '));

  const fn = compile(code);
  const sandbox = { db, ...shellGlobals(capture) };

  let timer;
  try {
    return await Promise.race([
      Promise.resolve(fn(sandbox)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out after ' + TIMEOUT_MS / 1000 + 's.')), TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Same, but never throws - shaped for the results pane. */
export async function runCode(db, code, { cap = 200 } = {}) {
  const started = Date.now();
  try {
    const value = await runOrThrow(db, code);
    const isArray = Array.isArray(value);
    return {
      ok: true,
      value: isArray && value.length > cap ? value.slice(0, cap) : value,
      truncated: isArray && value.length > cap,
      totalRows: isArray ? value.length : null,
      isUndefined: value === undefined,
      ms: Date.now() - started,
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), ms: Date.now() - started };
  }
}
