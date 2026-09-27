// The curriculum decides URLs and localStorage keys, so a typo here is a dead
// link or lost progress rather than a visible crash. Importing the exercise
// index already runs its own cross-checks; this covers the rest.

import { readFileSync } from 'node:fs';
import { MODULES, TRACKS, ALL_LESSONS, REFERENCES, EXERCISE_ORDER, TOPIC_PAGES } from '../content/curriculum.js';
import { OPERATORS } from '../content/operators.js';
import { LEGACY_IDS, migrateKeys } from '../content/legacy-ids.js';
import { EXERCISES } from '../server/exercises/index.js';
import ecommerce from '../server/datasets/ecommerce.js';

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

/* ---------- prompts have to stand on their own ---------- */

// Everything a learner reads has to make sense to someone who arrived from a
// search result. Three prompts pointed at "the notes" and "the end of Batch 3" -
// the private markdown files the lessons were written from, which nobody outside
// this repo has ever seen. They were invisible in review because whoever wrote
// them had read the notes.
const PRIVATE_SOURCE = /\bthe notes\b|\bbatch\s*\d|\bthe notes call\b/i;
const strangerUnsafe = [];
for (const e of EXERCISES) {
  const fields = [
    ['prompt', e.prompt],
    ['hint', e.hint],
    ['title', e.title],
    // The mistake notes are the largest block of prose a drill carries, and the
    // one written last - so it is the one most likely to lean on something only
    // the author can see.
    ...(e.mistakes ?? []).map((m, i) => [`mistakes[${i}]`, m]),
  ];
  for (const [field, text] of fields) {
    const hit = PRIVATE_SOURCE.exec(text ?? '');
    if (hit) strangerUnsafe.push(`${e.id} ${field}: "${hit[0]}"`);
  }
}
check('no drill points at the private source notes', strangerUnsafe.length === 0,
  strangerUnsafe.join('\n        '));

// Import-time validation already refuses a medium or hard drill with no
// `mistakes`, a repeat of its own hint, and more than three entries. What it
// cannot see is the whole set at once: the same generic line pasted onto twenty
// drills satisfies every per-drill rule and is worth nothing. A note is only
// useful if it is about *that* drill, and the cheap proxy for that is that no
// two drills say the same thing.
const noteOwners = new Map();
for (const e of EXERCISES) {
  for (const m of e.mistakes ?? []) {
    noteOwners.set(m, [...(noteOwners.get(m) ?? []), e.id]);
  }
}
const shared = [...noteOwners.entries()].filter(([, ids]) => ids.length > 1);
check('no mistake note is shared between drills', shared.length === 0,
  shared.map(([m, ids]) => `${ids.join(' + ')}: "${m.slice(0, 60)}..."`).join('\n        '));

const withNotes = EXERCISES.filter((e) => e.mistakes?.length);
console.log(`        ${withNotes.length}/${EXERCISES.length} drills say what usually goes wrong ` +
  `(${withNotes.reduce((n, e) => n + e.mistakes.length, 0)} notes)`);

/* ---------- counts written into prose ---------- */

// Six files state how much is on the site - the README twice, the package
// description, three page titles - and nothing checked any of them. §3 of the
// roadmap is a plan to grow past 38 exercises, so every one of those numbers is
// scheduled to become a lie, in the copy Google shows and the page a stranger
// reads first. The same hardcoded 38 already broke the DOM suite once.
//
// ROADMAP.md is deliberately not in this list: it is a log, and "the 38 that
// existed at the rename" is meant to stay 38.
const COUNTED = [
  ['README.md', readFileSync(new URL('../README.md', import.meta.url), 'utf8')],
  ['package.json', readFileSync(new URL('../package.json', import.meta.url), 'utf8')],
  ['CONTRIBUTING.md', readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8')],
  // Two source comments state the size of the operator list, and they rot the
  // same way a README does.
  ['src/scripts/editor.js', readFileSync(new URL('../src/scripts/editor.js', import.meta.url), 'utf8')],
  ['test/links.mjs', readFileSync(new URL('../test/links.mjs', import.meta.url), 'utf8')],
  ...['index', 'learn/index', 'practice/index', 'dataset'].map((p) => [
    `src/pages/${p}.astro`,
    readFileSync(new URL(`../src/pages/${p}.astro`, import.meta.url), 'utf8'),
  ]),
];

// The dataset's size is stated in five places and was checked in none of them,
// which is the same rot as a stale lesson count with a worse failure: a page
// that says "200 orders" over a seed that now builds 150 is wrong about the
// thing every exercise is graded against.
const store = ecommerce.build();

const noteCount = EXERCISES.reduce((n, e) => n + (e.mistakes?.length ?? 0), 0);
const CLAIMS = [
  [/(\d+)\s+lessons\b/g, ALL_LESSONS.length, 'lessons'],
  [/(\d+)\s+(?:auto-graded\s+)?exercises\b/g, EXERCISES.length, 'exercises'],
  [/(\d+)\s+drills\b/g, EXERCISES.length, 'drills'],
  [/(\d+)\s+modules\b/g, MODULES.length, 'modules'],
  [/(\d+)\s+tracks\b/g, TRACKS.length, 'tracks'],
  [/(\d+)\s+reference pages\b/g, REFERENCES.length, 'reference pages'],
  [/(\d+)\s+topic hubs\b/g, TOPIC_PAGES.length, 'topic hubs'],
  [/(\d+)\s+.?what usually goes wrong/g, noteCount, 'mistake notes'],
  [/(\d+)\s+operators\b/g, OPERATORS.length, 'operators the editor offers'],
  [/(\d+)\s+users\b/g, store.users.length, 'users in the dataset'],
  [/(\d+)\s+orders\b/g, store.orders.length, 'orders in the dataset'],
  [/(\d+)\s+products\b/g, store.products.length, 'products in the dataset'],
];

const staleCounts = [];
const hits = new Map(CLAIMS.map(([, , what]) => [what, 0]));
let claimsFound = 0;
for (const [file, text] of COUNTED) {
  for (const [pattern, truth, what] of CLAIMS) {
    for (const [whole, n] of text.matchAll(pattern)) {
      claimsFound++;
      hits.set(what, hits.get(what) + 1);
      if (Number(n) !== truth) staleCounts.push(`${file}: "${whole.trim()}" - there are ${truth} ${what}`);
    }
  }
}
check('every count written into prose matches the data', staleCounts.length === 0,
  staleCounts.join('\n        '));
// Without this the check passes just as happily if the regexes stop matching
// anything at all, which is how it would rot in silence.
check('the prose counts are actually being read', claimsFound >= 10, `${claimsFound} found`);
// And per pattern, not just in total: a regex that matches nothing is either a
// claim nobody makes any more - delete it - or a broken pattern, and one of
// these was once compiled with a literal backspace byte in it and could never
// have fired. The total above stayed comfortably green throughout.
const silent = [...hits].filter(([, n]) => n === 0).map(([what]) => what);
check('and every one of the patterns matches something', silent.length === 0,
  `never found in any counted file: ${silent.join(', ')}`);

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
