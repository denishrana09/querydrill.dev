# Contributing

Exercises and lessons are the most useful thing you can contribute, and they
need no database and no build step to write. If you have ten minutes, adding one
drill is a complete contribution.

## Get it running

```bash
npm install
npm run dev          # http://localhost:4321
```

Needs **Node 22 or newer** — the tests use the WebSocket client built into Node.

New markdown files and new pages appear without a restart. A change to
`src/content.config.mjs` does not: collections are registered when the dev server
starts, so adding one and then opening its route gives a 404 until you restart.
Nothing warns you, because from Astro's side the collection simply has no entries.

Nothing else. No MongoDB, no environment variables, no accounts. Queries run in
your browser through [mingo](https://github.com/kofrasa/mingo), so the site is a
pile of static files and the whole thing works offline.

```bash
npm test             # everything that needs no database or build (~5s)
npm run verify       # the above, plus a real build, links and a headless browser
```

Run `npm test` before opening a pull request. Run `npm run verify` if you touched
anything under `src/` or changed how a page is built.

Two of the suites drive a real Chrome or Edge, and they **skip** rather than fail
if neither is installed (`CHROME=/path/to/chrome` if yours is somewhere unusual).
Worth knowing if you touch the editor: jsdom cannot measure anything, so
CodeMirror does not mount there and `npm test` alone is driving the textarea
fallback. `npm run test:editor` is the one that sees the real thing.

## The one rule

**Nothing is graded against hardcoded JSON.** Your answer and the exercise's own
`solution` are run through the same executor against the same data, and the two
results are compared. This is why expected answers cannot rot when the seed data
changes, and it is the constraint behind most of the structure here — so an
exercise contributes a *solution*, never an expected output.

## Add an exercise

Two files. Both will shout at you if you miss a step, so you do not have to hold
the whole model in your head.

**1. Write the drill** in `server/exercises/batch1.js`, `batch2.js` or
`batch3.js`. The filenames are storage only — where a drill appears in the course
is decided in step 2, so put it in whichever file its topic already lives in.

```js
{
  id: 'orders-rated-four-plus',    // becomes the URL and the progress key - never change it later
  difficulty: 'easy',              // easy | medium | hard
  topics: ['find', '$gte'],        // must exist in content/topics.js
  title: 'Well-rated orders',
  prompt: 'Find orders with a `rating` of 4 or more. Return `_id` and `rating` only.',
  lesson: 'comparison-operators',  // a slug in content/lessons/
  starter: 'db.orders.find(\n  { },\n  { }\n)',
  hint: '$gte is "greater than or equal to".',
  mistakes: [                      // shown only after a failed attempt
    'Using `$gt` drops every order rated exactly 4, and 4 or more includes 4.',
  ],
  unordered: true,                 // set when the order of results should not matter
  solution: 'db.orders.find({ rating: { $gte: 4 } }, { _id: 1, rating: 1 })',
}
```

That example is real: it was added, run through `npm test`, and removed again while
writing this page.

Optional fields: `scaffold` (a heavier starter, revealed behind the help
ladder), and `type: 'write'` plus a `verify` query for a drill that mutates data.

**2. Put it in the course** — add the `id` to a module's `exercises` array in
[content/curriculum.js](content/curriculum.js). That array is the order drills
are shown in.

**3. `npm test`.**

Skipping step 2 fails immediately and says so:

```
Exercise orders-over-1000 is not listed in any module in content/curriculum.js.
```

Other messages you may see, and what they mean:

| message | fix |
|---|---|
| `uses topic "$gt", which is not in content/topics.js` | use an existing tag, or add yours to that file |
| `points at unknown lesson "…"` | the `lesson` slug must match a file in `content/lessons/` |
| `ships its own solution as the starter` | the starter must not be the answer |
| `has a "scaffold" identical to its starter` | drop the `scaffold`, or make it genuinely more helpful |
| `no visible result - …: returned [] - the filter matches nothing in the dataset` | see below |
| `names a lesson in its own or an earlier module` | your drill needs something the course has not taught yet |
| `is medium and has no "mistakes" - say what usually goes wrong here` | see below |
| `repeats its hint as a mistake` | the note has to add something the hint does not |
| `gives away its whole solution in a "mistakes" entry` | quote the fragment that goes wrong, not the answer |

**That empty-result one is the trap worth knowing about.** A drill whose solution
returns nothing still *passes* grading — the grader compares your answer against
the solution's result, so empty matches empty, and any wrong answer that also
finds nothing passes too. The learner types the right query, sees no output, and
cannot tell whether they got it right. So it is checked separately, and it is the
mistake to expect: write a filter against a field the collection does not
actually have and everything looks fine until this fires.

### `hint` and `mistakes` are shown at different moments

This is the distinction worth getting right, because it is easy to write the
wrong one.

- **`hint` is read before trying.** It points at the mechanism — which operator,
  which shape. It must not say what the wrong answer looks like, because at that
  point the reader has not written one, and telling them ahead of time is just
  the answer in a quieter voice.
- **`mistakes` is only ever shown after a failed attempt.** So it is free to say
  the thing a hint cannot: what the wrong query is, what its output looks like,
  and why that output seems fine. It appears under the diff, and a pass clears it.

The feedback above it already says *what* is wrong — `row _id=Laptop: revenue
expected 2000, got 50`. A note earns its place by saying *why* that happens:
summing a unit price without its quantity. One to three entries, and each one
should be about this drill rather than about MongoDB in general — a test fails if
two drills share a note, because a line generic enough to paste twice was not
worth showing once.

Required for `medium` and `hard`, optional for `easy`. What usually makes a drill
medium or hard is that it has a way of being wrong that does not throw, and
naming that way is the entire point of the field. An easy drill can genuinely
have nothing to say, and demanding one there would buy padding.

### What makes a good exercise

- **One concept per exercise.** Five variations on `$group` are one exercise, not
  five. Deliberately not competing on problem count — padded sets are what this
  project exists as an alternative to.
- **The starter shows structure, never the answer.** Give the call and empty
  slots; withhold the contents. All 38 drills were audited against this: they
  used to hand over 57% of their own solution on average, now 26%. If a learner
  only has to type one field name into a stage someone else built, they have not
  learned the stage.
- **The prompt stands alone.** State the goal, the collection, the exact shape
  expected, and whether order matters. Assume the reader has not read anything
  else on the site.
- **It must pass on the real data.** The dataset is 30 users, 200 orders and 11
  products — `ecommerce`, described at [/dataset/](src/pages/dataset.astro). A
  filter matching nothing is a broken exercise even though the code is valid.

## Add or fix a lesson

Lessons are markdown in [content/lessons/](content/lessons/). A new one needs an
entry in that module's `lessons` array in `content/curriculum.js` as well — the
title goes in both places, and a test fails if they drift.

Frontmatter:

```yaml
---
title: 'Comparison operators'
module: 'query-operators'
track: 'fundamentals'
description: 'One sentence, 40-165 characters. This becomes the Google snippet.'
topics: ['find', 'comparison', '$gte', '$lt']   # must exist in content/topics.js
---
```

`topics` is what the lesson **teaches**, not every operator it happens to
mention. It becomes the JSON-LD `teaches` property, it renders as the chip row
under the title, and — for the seven tags that have one — it is what puts the
lesson on a topic hub page. Concepts first, then operators. Tagging generously
is not a favour to anybody: a lesson that claims `$group` because the word
appears once will show up on `/topics/group/` above lessons that are actually
about it.

**Any fenced `js` block that starts with `db.<collection>.` becomes runnable on
the page** — a Run / Edit / Copy toolbar appears automatically, and readers can
change the query and run it again. Nothing to opt into. Two consequences:

- `npm test` executes every one of them and fails if it throws **or returns
  nothing**. An example returning `[]` is a broken lesson, not broken code: the
  reader presses Run, gets nothing, and concludes the site is wrong.
- If a block is a fragment meant to illustrate syntax rather than run, mark it
  ` ```js no-run `.

Each lesson should have at least one complete runnable example; a test enforces
that too.

## Pull requests

- Say what and why. A screenshot helps for anything visual.
- Keep commits few and their subjects short. Batch related changes rather than
  committing per file.
- Don't commit `dist/`.
- Adding a dependency needs a reason in the PR. The site ships exactly one
  runtime dependency on purpose, and everything else is a dev tool.

If you are unsure whether something is wanted, open an issue first — especially
for anything that changes the structure of the site. [ROADMAP.md](ROADMAP.md) is
the real backlog and says what is planned, deferred, and deliberately rejected;
[ARCHITECTURE.md](ARCHITECTURE.md) explains why the pieces are arranged the way
they are, including the traps already hit.

## Reporting a wrong answer

If a drill marks a correct answer wrong, that is the highest-priority kind of
bug. Include the exercise id, exactly what you typed, and the feedback you got.
