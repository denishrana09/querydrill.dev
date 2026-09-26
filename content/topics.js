// The tag vocabulary, closed, in one place.
//
// Measured 2026-09-27, before this file existed: 43 tags across 38 drills, 29 of
// them on exactly one drill. Three findings shaped what is here, and all three
// were measurements rather than opinions.
//
// `aggregation` was byte-identical to "track is not fundamentals" on all 23 of
// its drills, and `find` + `update` partitioned the fundamentals track exactly -
// 9 and 6, no overlap. Those three tags were the `track` and `module` fields
// spelled a second time, in a place nothing could keep in step with them. A
// filter that keeps 23 of 38 rows is also not a filter. `aggregation` is gone;
// `find` and `update` stay because read-vs-write is a real thing to filter on
// and neither is a page that already exists.
//
// 32 of the 43 tags never left a single module. For those, `/modules/<slug>/` is
// already that filter and it has a title, a goal and prose - a chip is a worse
// version of a page that exists. So a tag becomes a clickable filter only if it
// crosses a module boundary *and* has MIN_FILTER_DRILLS behind it. The rest stay
// labels: informative, and visibly not controls, which is the actual complaint
// in the roadmap - a chip that looks clickable and is not is worse than no chip.
//
// What is deliberately NOT merged, against the roadmap's own note: `sort` and
// `$sort` are the cursor method and the pipeline stage. So are `projection` and
// `$project`, and `.skip()/.limit()` and `$skip`/`$limit`. Same goal, different
// mechanism, and reaching for the wrong one is a mistake people actually make -
// merging them would teach that they are interchangeable. They keep separate
// tags, and the cursor-side ones carry the syntax you type in their label, so
// `.sort()` next to `$sort` reads as a distinction instead of a typo.

/** A tag needs this many drills before it is worth clicking. */
export const MIN_FILTER_DRILLS = 3;

const concept = (slug, label = slug) => ({ slug, label, kind: 'concept' });
const operator = (slug, label = slug) => ({ slug, label, kind: 'operator' });

// Declared in curriculum order, not alphabetically or by count, because this is
// also the order the filter row renders in - and a learner scanning it should
// travel the same path the course does.
export const TOPICS = [
  /* reading */
  concept('find', 'find()'),
  concept('projection'),
  concept('comparison'),
  concept('logical'),
  concept('nested', 'nested fields'),
  concept('arrays'),
  concept('sort', '.sort()'),
  concept('pagination', '.skip() / .limit()'),
  operator('$eq'),
  operator('$gte'),
  operator('$lt'),
  operator('$in'),
  operator('$nin'),
  operator('$or'),
  operator('$and'),
  operator('$all'),
  operator('$elemMatch'),

  /* writing */
  concept('update'),
  concept('upsert'),
  concept('atomicity'),
  concept('positional', 'positional $'),
  operator('$set'),
  operator('$inc'),
  operator('$push'),
  operator('$addToSet'),
  operator('$pull'),

  /* pipeline */
  operator('$match'),
  operator('$sort'),
  operator('$skip'),
  operator('$limit'),
  operator('$count'),
  operator('$project'),
  operator('$size'),
  operator('$group'),
  operator('$sum'),
  operator('$avg'),
  operator('$min'),
  operator('$max'),
  operator('$first'),
  operator('$last'),
  operator('$add'),
  operator('$multiply'),
  operator('$arrayElemAt'),
  operator('$unwind'),
  operator('$lookup'),
  operator('$expr'),

  /* expressions, facets, dates */
  operator('$filter'),
  operator('$map'),
  operator('$reduce'),
  operator('$cond'),
  operator('$ifNull'),
  operator('$facet'),
  concept('dates'),
  operator('$year'),
  operator('$month'),
  operator('$dateToString'),
];

const BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

export const TOPIC_SLUGS = TOPICS.map((t) => t.slug);

/** The chip text for a tag. Unknown tags render as themselves rather than vanishing. */
export const labelOf = (slug) => BY_SLUG.get(slug)?.label ?? slug;

export const isTopic = (slug) => BY_SLUG.has(slug);

/**
 * How far each tag reaches, given a set of drills.
 * @returns {Map<string, {count: number, modules: Set<string>}>}
 */
export function reachOf(exercises) {
  const reach = new Map();
  for (const e of exercises) {
    for (const slug of e.topics) {
      if (!reach.has(slug)) reach.set(slug, { count: 0, modules: new Set() });
      const r = reach.get(slug);
      r.count++;
      r.modules.add(e.module);
    }
  }
  return reach;
}

/**
 * The tags worth making clickable, in TOPICS order.
 *
 * Computed rather than listed, so the filter row cannot drift from the content.
 * The flip side is that adding drills silently changes the row - which is why
 * test/topics.mjs prints what qualifies, so growth past 38 is a prompt to look
 * rather than something that happens behind your back.
 */
export function filtersFor(exercises) {
  const reach = reachOf(exercises);
  return TOPICS.filter((t) => {
    const r = reach.get(t.slug);
    return r && r.count >= MIN_FILTER_DRILLS && r.modules.size > 1;
  }).map((t) => ({ ...t, count: reach.get(t.slug).count }));
}
