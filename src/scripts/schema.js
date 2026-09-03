// Infers a readable shape from a collection.
//
// A single raw document is a poor way to show structure: it needs two
// scrollbars, buries the field names in punctuation, and — worst — makes an
// optional field look mandatory. This dataset deliberately puts `discount` and
// `rating` on only some orders so the $ifNull drills have something to bite on,
// and a learner cannot see that from one sample. Reporting presence percentages
// turns that from a hidden trap into a visible fact about the data.

const typeOf = (v) => {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Date) return 'date';
  return typeof v; // string | number | boolean | object
};

const preview = (v) => {
  const t = typeOf(v);
  if (t === 'string') return `"${v.length > 18 ? v.slice(0, 17) + '…' : v}"`;
  if (t === 'date') return v.toISOString().slice(0, 10);
  if (t === 'number' || t === 'boolean') return String(v);
  return '';
};

/**
 * Flat, render-ready field list. Array-of-object fields are descended into, so
 * `items.price` shows up as its own row — which is exactly the path a learner
 * needs to type for dot notation and `$unwind`.
 *
 * @returns {{path:string,name:string,depth:number,type:string,presence:number,sample:string,inArray:boolean}[]}
 */
export function inferSchema(docs, { maxDepth = 2 } = {}) {
  const rows = [];

  const walk = (items, prefix, depth, inArray) => {
    if (!items.length || depth > maxDepth) return;

    const seen = new Map(); // field -> { types:Set, present:number, sample }
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (const [k, v] of Object.entries(item)) {
        let entry = seen.get(k);
        if (!entry) seen.set(k, (entry = { types: new Set(), present: 0, sample: undefined }));
        entry.present++;
        entry.types.add(typeOf(v));
        if (entry.sample === undefined && v !== null && v !== undefined) entry.sample = v;
      }
    }

    for (const [name, entry] of seen) {
      const path = prefix ? `${prefix}.${name}` : name;
      const types = [...entry.types].filter((t) => t !== 'null');

      rows.push({
        path,
        name,
        depth,
        type: types.length ? types.join(' | ') : 'null',
        presence: entry.present / items.length,
        sample: preview(entry.sample),
        inArray,
      });

      // Descend into nested objects and into arrays of objects.
      const nested = [];
      let nestedIsArray = false;
      for (const item of items) {
        const v = item?.[name];
        if (Array.isArray(v)) { nestedIsArray = true; nested.push(...v); }
        else if (v && typeof v === 'object' && !(v instanceof Date)) nested.push(v);
      }
      if (nested.some((n) => n && typeof n === 'object' && !Array.isArray(n))) {
        walk(nested, path, depth + 1, nestedIsArray || inArray);
      }
    }
  };

  walk(docs, '', 0, false);
  return rows;
}
