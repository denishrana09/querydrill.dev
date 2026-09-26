// Decides which fenced code blocks on a reading page get a Run button.
//
// The rule is deliberately narrow: the block has to open with `db.<collection>.`
// naming a collection that exists in the bundled dataset. That is the shape of a
// complete query, and it is what separates the examples from the teaching
// fragments - half the lessons introduce a stage with a bare `{ $group: {...} }`,
// which is valid JavaScript, throws nothing, and produces nothing worth showing.
// Offering to run those would make the feature look broken on its best pages.
//
// Anything cleverer than this needs a real parser. The guard against the rule
// being wrong is not this file, it is `test/examples.mjs`: it executes every
// block the rule marks and fails on any error, so a fence that merely looks like
// a query is caught in CI and opts out explicitly with ```js no-run.

import ecommerce from '../server/datasets/ecommerce.js';

// Read off the dataset rather than written out here, so renaming a collection
// cannot silently turn every example on the site back into plain text.
export const COLLECTIONS = new Set(Object.keys(ecommerce.build()));

/** Fence meta that suppresses the Run button: ```js no-run */
export const NO_RUN = 'no-run';

/** @param {string} code @param {string} lang @param {string} meta fence info string after the lang */
export function isRunnable(code, lang, meta = '') {
  if (lang !== 'js') return false;
  if (String(meta || '').split(/\s+/).includes(NO_RUN)) return false;
  const open = /^db\.([A-Za-z_$][\w$]*)\s*\./.exec(String(code).trim());
  return Boolean(open && COLLECTIONS.has(open[1]));
}

const FENCE = /^```([^\s`\r\n]*)([^\r\n]*)\r?\n([\s\S]*?)^```/gm;

/**
 * Every fenced block in a markdown source, with the runnable verdict attached.
 * Used by the pages (to decide whether to ship the island at all) and by the
 * test (to execute them) - one parser, so the two cannot disagree about which
 * blocks are in play.
 *
 * @returns {{lang:string, meta:string, code:string, runnable:boolean}[]}
 */
export function fencesIn(markdown) {
  const out = [];
  // `lastIndex` is carried on the regex literal, so reset before every scan.
  FENCE.lastIndex = 0;
  let m;
  while ((m = FENCE.exec(markdown))) {
    const [, lang, meta, body] = m;
    const code = body.replace(/\s+$/, '');
    out.push({ lang, meta: meta.trim(), code, runnable: isRunnable(code, lang, meta) });
  }
  return out;
}

/** True if a markdown source has at least one block worth shipping the island for. */
export const hasRunnable = (markdown) => fencesIn(markdown).some((f) => f.runnable);
