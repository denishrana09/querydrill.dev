// Shell-style rendering of a query result, shared by the practice app's results
// pane and the runnable examples on lesson pages.
//
// One implementation on purpose. The whole claim the lesson examples make is
// "this is the same engine the exercises use", and two renderers that disagree
// about how a date or an empty array prints would quietly make that false.

export const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * Value -> HTML with `.k/.s/.num/.b/.d` spans for the syntax colours. Indentation
 * is two spaces per level, emitted as text, so the container only needs
 * `white-space: pre`.
 */
export function highlight(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (value === null) return '<span class="b">null</span>';
  if (value === undefined) return '<span class="b">undefined</span>';
  if (typeof value === 'boolean') return `<span class="b">${value}</span>`;
  if (typeof value === 'number') return `<span class="num">${value}</span>`;
  if (typeof value === 'string') return `<span class="s">"${esc(value)}"</span>`;
  // Dates print shell-style, matching what the notes show.
  if (value instanceof Date) return `<span class="d">ISODate("${value.toISOString()}")</span>`;

  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map((v) => padIn + highlight(v, indent + 1)).join(',\n') + '\n' + pad + ']';
  }

  const keys = Object.keys(value);
  if (!keys.length) return '{}';
  const rows = keys.map(
    (k) => `${padIn}<span class="k">${esc(k)}</span>: ${highlight(value[k], indent + 1)}`
  );
  return '{\n' + rows.join(',\n') + '\n' + pad + '}';
}
