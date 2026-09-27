// Guards the tag vocabulary in content/topics.js.
//
// The vocabulary rotted quietly once already: 43 tags over 38 drills, 29 of them
// on a single drill, `sort` and `$sort` both present, `aggregation` on 23, and a
// lesson advertising `$contains` - an operator its own prose says does not exist.
// None of that was visible from any one file, which is why it survived. Every
// check here is one of those failures turned into an alarm.
//
//   node test/topics.mjs

import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { EXERCISES } from '../server/exercises/index.js';
import { TRACKS, TOPIC_PAGES } from '../content/curriculum.js';
import { TOPICS, TOPIC_SLUGS, MIN_FILTER_DRILLS, filtersFor, reachOf, labelOf } from '../content/topics.js';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

const reach = reachOf(EXERCISES);
const filters = filtersFor(EXERCISES);

/* ---------- nothing dead, nothing undeclared ---------- */

// The undeclared direction already throws at import time in
// server/exercises/index.js; this is the other direction, which nothing else
// covers. A tag no drill and no lesson uses is a filter that renders an empty
// list, or a topic page with nothing on it.
const lessonTopics = new Set();
for (const dir of ['lessons', 'reference']) {
  const base = new URL(`../content/${dir}/`, import.meta.url);
  for (const file of readdirSync(base)) {
    const src = readFileSync(new URL(file, base), 'utf8');
    const m = /^topics:\s*\[(.*)\]/m.exec(src);
    if (!m) continue;
    for (const raw of m[1].split(',')) {
      const t = raw.trim().replace(/^'|'$/g, '');
      if (t) lessonTopics.add(t);
    }
  }
}

const dead = TOPIC_SLUGS.filter((s) => !reach.has(s) && !lessonTopics.has(s));
check('every tag in the vocabulary is used by a drill or a lesson', dead.length === 0,
  `unused: ${dead.join(' ')}`);

// The same closed-vocabulary rule the zod schema applies at build time, checked
// here so it fails in a second rather than after a full build.
const strayTopics = [...lessonTopics].filter((op) => !TOPIC_SLUGS.includes(op));
check('every topic a lesson declares is in the vocabulary', strayTopics.length === 0,
  `${strayTopics.join(' ')} - add to content/topics.js, or fix the spelling`);

/* ---------- one idea, one spelling ---------- */

const labels = TOPICS.map((t) => labelOf(t.slug));
const dupLabels = labels.filter((l, i) => labels.indexOf(l) !== i);
check('no two tags render the same chip text', dupLabels.length === 0, dupLabels.join(' '));

// These pairs are the same goal reached two ways: the cursor method and the
// pipeline stage. They are deliberately NOT merged - which one to use is a real
// decision, and a learner who thinks they are interchangeable has learnt
// something false. The price of keeping both is that the chips must not look
// like a typo for each other, so their labels have to differ.
const MECHANISM_PAIRS = [['sort', '$sort'], ['projection', '$project'], ['pagination', '$skip']];
const collapsed = MECHANISM_PAIRS.filter(([a, b]) =>
  !TOPIC_SLUGS.includes(a) || !TOPIC_SLUGS.includes(b) || labelOf(a) === labelOf(b));
check('cursor-method and pipeline-stage tags stay distinguishable', collapsed.length === 0,
  collapsed.map(([a, b]) => `${a} / ${b}`).join(', '));

/* ---------- a tag must not restate the structure ---------- */

// `aggregation` was on 23 of 38 drills and was byte-identical to "track is not
// fundamentals". A tag that names a track is the track spelled twice, in a place
// nothing keeps in step with it.
const trackNames = new Set(TRACKS.map((t) => t.slug));
const structural = TOPIC_SLUGS.filter((s) => trackNames.has(s));
check('no tag is just the name of a track', structural.length === 0, structural.join(' '));

// The general version, and the one that would have caught the real thing: a tag
// whose drills are exactly some module, some track, or any combination of tracks
// is that structure spelled a second time. `aggregation` was the union of two
// tracks - "everything that is not fundamentals" - so a check that only compared
// against a single track would have let it through, and the first version here
// did. Three tracks means seven combinations; cheap enough to check them all.
const idsOf = (pred) => new Set(EXERCISES.filter(pred).map((e) => e.id));
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Only structures with a few drills in them count. `sort` currently covers
// exactly the drills of `sorting-and-paging` - because that module has one drill.
// That is a coincidence of a thin module, not a tag restating anything, and it
// resolves itself the moment the module is filled out (§3 of the roadmap wants
// exactly that). The failure being guarded against is a tag standing in for a
// real structure, which needs a real structure to stand in for.
const MEANINGFUL = 3;

const structures = [];
for (const m of new Set(EXERCISES.map((e) => e.module))) {
  structures.push([`module "${m}"`, idsOf((e) => e.module === m)]);
}
const trackSlugs = [...new Set(EXERCISES.map((e) => e.track))];
for (let mask = 1; mask < 1 << trackSlugs.length; mask++) {
  const picked = trackSlugs.filter((_, i) => mask & (1 << i));
  structures.push([
    picked.length === 1 ? `track "${picked[0]}"` : `tracks ${picked.map((t) => `"${t}"`).join(' + ')}`,
    idsOf((e) => picked.includes(e.track)),
  ]);
}

const restated = [];
for (const slug of reach.keys()) {
  const tagged = idsOf((e) => e.topics.includes(slug));
  const hit = structures.find(([, ids]) => ids.size >= MEANINGFUL && same(tagged, ids));
  if (hit) restated.push(`${slug} is exactly ${hit[0]} (${tagged.size} drills) - that is the structure, spelled twice`);
}
check('no tag restates a module, a track, or a set of tracks', restated.length === 0,
  restated.join('\n        '));

/* ---------- tags must not lie ---------- */

// Every operator tag has to appear in the drill's own solution. This was clean
// on all 52 when measured, so it is cheap to keep clean - and it is the check
// that stops a tag surviving a rewritten solution.
const phantom = [];
for (const e of EXERCISES) {
  const used = new Set(e.solution.match(/\$[a-zA-Z][a-zA-Z0-9]*/g) ?? []);
  for (const t of e.topics) {
    if (t.startsWith('$') && !used.has(t)) phantom.push(`${e.id} tags ${t}, its solution never uses it`);
  }
}
check('every operator tag appears in that drill\'s solution', phantom.length === 0,
  phantom.join('\n        '));

/* ---------- the filter row has to be worth looking at ---------- */

// The floor is written out here rather than imported, deliberately. Checking
// filtersFor() against the same constant filtersFor() used only proves the
// module agrees with itself: lowering MIN_FILTER_DRILLS to 1 passed that version
// of this check while putting three 2-drill chips in the row. This is the number
// the project decided on, so changing the policy has to fail here and be an
// argument someone makes on purpose.
const FLOOR = 3;
check(`the floor for a filter is still ${FLOOR} drills`, MIN_FILTER_DRILLS >= FLOOR,
  `content/topics.js sets MIN_FILTER_DRILLS to ${MIN_FILTER_DRILLS}`);

const weak = filters.filter((f) => f.count < FLOOR || reach.get(f.slug).modules.size < 2);
check(`every filter has ${FLOOR}+ drills across 2+ modules`, weak.length === 0,
  weak.map((f) => `${f.slug} (${f.count})`).join(' '));

// A row nobody can scan is the failure this whole exercise was about. 43 chips
// was the old state; an upper bound keeps the derived list from drifting back.
check('the filter row stays scannable', filters.length >= 4 && filters.length <= 12,
  `${filters.length} filters`);

check('every filter is a tag that exists', filters.every((f) => TOPIC_SLUGS.includes(f.slug)));

/* ---------- the topic hub pages ---------- */

// TOPIC_PAGES is written out by hand in content/curriculum.js, because that file
// has no imports - the sitemap and the link checker have to read every URL the
// site publishes without loading the exercise set. The cost of that is a list
// capable of drifting from the tags that actually earned a page and from the
// files on disk, so all three are compared here.
{
  const pageTopics = TOPIC_PAGES.map((t) => t.topic).sort();
  const filterTopics = filters.map((f) => f.slug).sort();
  check('there is a topic page for exactly the tags that earned a filter',
    pageTopics.join() === filterTopics.join(),
    `pages: ${pageTopics.join(' ')}\n        filters: ${filterTopics.join(' ')}`);

  // A `$` in a URL path is legal and horrible, so the slug drops it - and
  // nothing else is allowed to differ, or the URL stops being guessable from
  // the tag.
  const misnamed = TOPIC_PAGES.filter((t) => t.slug !== t.topic.replace(/^\$/, ''));
  check('every topic page URL is its tag without the $', misnamed.length === 0,
    misnamed.map((t) => `${t.topic} -> /topics/${t.slug}/`).join(', '));

  const dir = new URL('../content/topic-pages/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  const listed = TOPIC_PAGES.map((t) => t.slug);
  check('every listed topic page has a markdown file, and vice versa',
    [...files].sort().join() === [...listed].sort().join(),
    `files: ${files.sort().join(' ')}\n        listed: ${listed.sort().join(' ')}`);

  const wrongTag = [];
  for (const t of TOPIC_PAGES) {
    if (!files.includes(t.slug)) continue;
    const src = readFileSync(new URL(`${t.slug}.md`, dir), 'utf8');
    const declared = /^topic:\s*'([^']+)'/m.exec(src)?.[1];
    if (declared !== t.topic) wrongTag.push(`${t.slug}.md says ${declared}, list says ${t.topic}`);
  }
  check('each page declares the tag the list says it covers', wrongTag.length === 0,
    wrongTag.join('\n        '));

  // The anti-thin rule, and the reason the lessons were retagged before these
  // pages were built. A hub with nothing under it is a doorway page: it ranks
  // for a while, helps nobody, and is the exact thing this project decided not
  // to do when it refused to compete on generated problem count. Written out
  // rather than imported, for the same reason as FLOOR above.
  const MIN_LESSONS = 1;
  const MIN_DRILLS = 3;
  const lessonsFor = new Map(TOPIC_PAGES.map((t) => [t.topic, 0]));
  for (const dirName of ['lessons']) {
    const base = new URL(`../content/${dirName}/`, import.meta.url);
    for (const file of readdirSync(base)) {
      const m = /^topics:\s*\[(.*)\]/m.exec(readFileSync(new URL(file, base), 'utf8'));
      if (!m) continue;
      for (const raw of m[1].split(',')) {
        const t = raw.trim().replace(/^'|'$/g, '');
        if (lessonsFor.has(t)) lessonsFor.set(t, lessonsFor.get(t) + 1);
      }
    }
  }
  const thin = TOPIC_PAGES
    .map((t) => ({
      t,
      lessons: lessonsFor.get(t.topic) ?? 0,
      drills: EXERCISES.filter((e) => e.topics.includes(t.topic)).length,
    }))
    .filter((x) => x.lessons < MIN_LESSONS || x.drills < MIN_DRILLS);
  check(`every topic page has ${MIN_LESSONS}+ lesson and ${MIN_DRILLS}+ drills behind it`,
    thin.length === 0,
    thin.map((x) => `/topics/${x.t.slug}/ has ${x.lessons} lesson(s), ${x.drills} drill(s)`).join('\n        '));
}

/* ---------- report, including what is close to earning a chip ---------- */

console.log(`\n  ${TOPIC_SLUGS.length} tags · ${filters.length} promoted to filters:`);
console.log(`    ${filters.map((f) => `${labelOf(f.slug)} (${f.count})`).join('  ')}`);

// The filter list is computed, so adding drills can change it without anyone
// asking. This is the prompt to look: a tag one drill short of qualifying is
// about to appear in the row, and a tag stuck on one module never will.
const nearly = [...reach]
  .filter(([s, r]) => !filters.some((f) => f.slug === s) && r.count >= MIN_FILTER_DRILLS - 1)
  .sort((a, b) => b[1].count - a[1].count);
if (nearly.length) {
  console.log('\n  close to earning a filter (not one yet):');
  for (const [s, r] of nearly) {
    const why = r.modules.size < 2 ? `only in ${[...r.modules][0]}` : `needs ${MIN_FILTER_DRILLS - r.count} more drill(s)`;
    console.log(`    ${labelOf(s).padEnd(20)} ${r.count} drill(s), ${r.modules.size} module(s) - ${why}`);
  }
}

const covered = EXERCISES.filter((e) => e.topics.some((t) => filters.some((f) => f.slug === t))).length;
console.log(`\n  ${covered}/${EXERCISES.length} drills reachable by at least one filter` +
  ` · the rest are found through All, their module, or search`);

console.log(failed ? `\n  \x1b[31m${failed} topic check(s) failed\x1b[0m\n` : `\n  ${green('topics OK')}\n`);
process.exit(failed ? 1 : 0);
