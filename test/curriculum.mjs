// The curriculum decides URLs and localStorage keys, so a typo here is a dead
// link or lost progress rather than a visible crash. Importing the exercise
// index already runs its own cross-checks; this covers the rest.

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

/* ---------- source ranges ---------- */

// Two lessons written from the same lines means one of them duplicates the
// other's content, which is the kind of thing only a check notices.
const ranges = {};
for (const l of ALL_LESSONS) {
  (ranges[l.source.file] ??= []).push({ ...l.source, slug: l.slug });
}
const overlaps = [];
for (const [file, rs] of Object.entries(ranges)) {
  rs.sort((a, b) => a.from - b.from);
  for (let i = 1; i < rs.length; i++) {
    if (rs[i].from <= rs[i - 1].to) overlaps.push(`${file}: ${rs[i - 1].slug} / ${rs[i].slug}`);
  }
}
check('no two lessons are written from the same lines', overlaps.length === 0, overlaps.join('; '));
check('every source range runs forwards', ALL_LESSONS.every((l) => l.source.from < l.source.to));

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

check('every exercise is reachable from an old id',
  EXERCISES.every((e) => Object.values(LEGACY_IDS).includes(e.id)),
  EXERCISES.filter((e) => !Object.values(LEGACY_IDS).includes(e.id)).map((e) => e.id).join(', '));

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
