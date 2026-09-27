// The curriculum decides URLs and localStorage keys, so a typo here is a dead
// link or lost progress rather than a visible crash. Importing the exercise
// index already runs its own cross-checks; this covers the rest.

import { readFileSync } from 'node:fs';
import { MODULES, TRACKS, ALL_LESSONS, REFERENCES, EXERCISE_ORDER } from '../content/curriculum.js';
import { LEGACY_IDS, migrateKeys } from '../content/legacy-ids.js';
import { EXERCISES } from '../server/exercises/index.js';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const dupes = (xs) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

/* ---------- slugs ---------- */

const allSlugs = [
  ...TRACKS.map((t) => t.slug),
  ...MODULES.map((m) => m.slug),
  ...ALL_LESSONS.map((l) => l.slug),
  ...REFERENCES.map((r) => r.slug),
  ...EXERCISE_ORDER,
];
check('every slug is URL-safe', allSlugs.every((s) => SLUG.test(s)),
  allSlugs.filter((s) => !SLUG.test(s)).join(', '));

// Lessons and exercises live under different path prefixes, so a shared name is
// fine and often desirable. Collisions *within* one namespace are not.
for (const [what, xs] of [
  ['track', TRACKS.map((t) => t.slug)],
  ['module', MODULES.map((m) => m.slug)],
  ['lesson', ALL_LESSONS.map((l) => l.slug)],
  ['reference', REFERENCES.map((r) => r.slug)],
]) {
  check(`${what} slugs are unique`, dupes(xs).length === 0, dupes(xs).join(', '));
}

check('every module belongs to a declared track',
  MODULES.every((m) => TRACKS.some((t) => t.slug === m.track)),
  MODULES.filter((m) => !TRACKS.some((t) => t.slug === m.track)).map((m) => m.slug).join(', '));

check('every track has at least one module',
  TRACKS.every((t) => MODULES.some((m) => m.track === t.slug)));

check('every module has lessons and drills',
  MODULES.every((m) => m.lessons.length && m.exercises.length),
  MODULES.filter((m) => !m.lessons.length || !m.exercises.length).map((m) => m.slug).join(', '));

check('every module states a goal', MODULES.every((m) => m.goal && m.summary));

/* ---------- lesson files ---------- */

// The curriculum promising a page that has no prose behind it is a 404, so
// check that every slug it names actually has a file, with real frontmatter.
const pages = [
  ...ALL_LESSONS.map((l) => ({ ...l, dir: 'lessons' })),
  ...REFERENCES.map((r) => ({ ...r, dir: 'reference' })),
];

const read = (p) => {
  try {
    return readFileSync(new URL(`../content/${p.dir}/${p.slug}.md`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
};

const files = new Map(pages.map((p) => [p.slug, read(p)]));
check('every lesson and reference page has a file',
  [...files.values()].every(Boolean),
  pages.filter((p) => !files.get(p.slug)).map((p) => p.slug).join(', '));

const frontmatter = (text) => {
  const end = text.indexOf('\n---\n', 4);
  return end < 0 ? null : text.slice(4, end);
};
const field = (text, name) => frontmatter(text)?.match(new RegExp(`^${name}: '(.*)'$`, 'm'))?.[1];

// A title in two places can drift. This is the check that makes that safe.
const mismatched = pages.filter((p) => {
  const text = files.get(p.slug);
  return text && field(text, 'title')?.replace(/''/g, "'") !== p.title;
});
check('page titles match the curriculum', mismatched.length === 0,
  mismatched.map((p) => `${p.slug}: '${field(files.get(p.slug), 'title')}' vs '${p.title}'`).join('; '));

// The description is the search result snippet. An empty one is a page Google
// writes the summary for instead of you.
const descs = pages.map((p) => ({ slug: p.slug, d: field(files.get(p.slug) ?? '', 'description') }));
check('every page has a description', descs.every((x) => x.d && x.d.length > 40),
  descs.filter((x) => !x.d || x.d.length <= 40).map((x) => x.slug).join(', '));
check('descriptions fit a search result', descs.every((x) => !x.d || x.d.length <= 165),
  descs.filter((x) => x.d && x.d.length > 165).map((x) => `${x.slug} (${x.d.length})`).join(', '));

// The notes were one long document. Anything still pointing at "Batch 2" is a
// reference to a thing this site does not have.
const stale = pages.filter((p) => {
  const text = files.get(p.slug);
  return text && /\bbatch\s*\d/i.test(text.slice(text.indexOf('\n---\n', 4)));
});
check('no page still refers to a batch', stale.length === 0, stale.map((p) => p.slug).join(', '));

check('every lesson opens with prose, not a heading or code', ALL_LESSONS.every((l) => {
  const text = files.get(l.slug);
  const body = text.slice(text.indexOf('\n---\n', 4) + 5).trimStart();
  return !/^(#|```|\||>)/.test(body);
}), ALL_LESSONS.filter((l) => {
  const text = files.get(l.slug);
  const body = text.slice(text.indexOf('\n---\n', 4) + 5).trimStart();
  return /^(#|```|\||>)/.test(body);
}).map((l) => l.slug).join(', '));

/* ---------- exercises ---------- */

check('exercise ids match the curriculum order',
  EXERCISES.map((e) => e.id).join() === EXERCISE_ORDER.join());

check('every exercise names a lesson in its own or an earlier module', (() => {
  const moduleIndex = Object.fromEntries(MODULES.map((m, i) => [m.slug, i]));
  const lessonModule = Object.fromEntries(ALL_LESSONS.map((l) => [l.slug, l.module]));
  return EXERCISES.every((e) => moduleIndex[lessonModule[e.lesson]] <= moduleIndex[e.module]);
})(), EXERCISES.filter((e) => {
  const moduleIndex = Object.fromEntries(MODULES.map((m, i) => [m.slug, i]));
  const lessonModule = Object.fromEntries(ALL_LESSONS.map((l) => [l.slug, l.module]));
  return moduleIndex[lessonModule[e.lesson]] > moduleIndex[e.module];
}).map((e) => `${e.id} -> ${e.lesson}`).join(', '));

const spread = { easy: 0, medium: 0, hard: 0 };
for (const e of EXERCISES) spread[e.difficulty]++;
check('difficulty is not all one value', Object.values(spread).every((n) => n > 0),
  JSON.stringify(spread));

/* ---------- legacy ids ---------- */

check('every legacy id maps to a real exercise',
  Object.values(LEGACY_IDS).every((slug) => EXERCISES.some((e) => e.id === slug)),
  Object.values(LEGACY_IDS).filter((s) => !EXERCISES.some((e) => e.id === s)).join(', '));

// This used to assert the opposite direction too - that every exercise is
// reachable from an old id. That was true of the 38 that existed at the rename
// and false of every exercise added since, which made it a standing "no new
// drills" rule in a project whose whole §3 plan is to grow past 38. It failed on
// the first exercise added by following CONTRIBUTING.md, which is how it was
// found. A new drill has no old id because it never had one; that is not a bug.
//
// What is worth guarding is the map not shrinking. Dropping entries from it
// costs early users their progress silently, with nothing else to notice.
const MIGRATED_AT_RENAME = 38;
check(`the legacy map still covers all ${MIGRATED_AT_RENAME} pre-rename drills`,
  Object.keys(LEGACY_IDS).length >= MIGRATED_AT_RENAME,
  `${Object.keys(LEGACY_IDS).length} entries - removing them loses progress for anyone who practised before the rename`);

const migrated = migrateKeys({ 'b1-01': 'pass', 'b2-03': 'fail' });
check('migration rewrites old keys',
  migrated['find-with-projection'] === 'pass' && migrated['count-by-group'] === 'fail' &&
  !('b1-01' in migrated),
  JSON.stringify(migrated));

const both = migrateKeys({ 'b1-01': 'fail', 'find-with-projection': 'pass' });
check('a current key beats a legacy one', both['find-with-projection'] === 'pass',
  JSON.stringify(both));

const clean = { 'find-with-projection': 'pass' };
check('nothing to migrate returns the same object', migrateKeys(clean) === clean);
check('migration tolerates junk', migrateKeys(null) === null && migrateKeys(undefined) === undefined);

console.log(failed ? `\n  \x1b[31m${failed} curriculum check(s) failed\x1b[0m\n` : `\n  ${green('curriculum OK')}\n`);
process.exit(failed ? 1 : 0);
