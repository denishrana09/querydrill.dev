# Architecture

How the pieces fit, and the traps that are easy to fall back into. Read this
before changing the engines or the build.

## The shape

Two engines run the *same* exercise set, and a test proves they agree.

```
                    engine/compare.js      <- grading rules, no Node, no driver
                          |
        +-----------------+------------------+
        |                                    |
  engine/mingo-db.js                   server/runner.js
  engine/run.js                        server/mongo.js
  (in-browser, mingo)                  (real mongod, official driver)
        |                                    |
  the hosted static site               local mode + conformance oracle
```

- `engine/` — shared, browser-safe. No Node built-ins, no `mongodb` import.
- `server/` — Node side. Datasets and exercises live here but are **pure data**,
  so the browser bundle imports them directly.
- `src/` — the Astro site.
- `local-mode/` — deferred; see below.

## The invariant that matters

**The same user code string must run unchanged on both engines.** That is what
makes one exercise set serve both, and what `test/conformance.mjs` checks:
every reference solution runs on real MongoDB *and* on mingo against identical
seed data, and the results must match under the grader's own rules.

If you add an exercise using something mingo cannot do, conformance goes red
before a learner ever sees it. That is the point.

The gap conformance does *not* cover is prose: `server/runner.js` allows a method
the browser shim never implemented, and a lesson teaches it. That is how
`replaceOne` came to be documented on a site that could not run it, and it only
surfaced once `test/examples.mjs` started executing the lessons. `findOneAndUpdate`
and `bulkWrite` are still in that position — allowed on the driver side, missing
from `engine/mingo-db.js` — and are fine only because nothing on the site mentions
them. Teach one and it has to be implemented first.

## The content model

`content/curriculum.js` is the single source of truth for **ordering and URLs**:

```
tracks  ->  modules  ->  lessons      (content/lessons/<slug>.md, /learn/<slug>)
                     ->  exercises    (server/exercises/*.js,     /practice/<slug>)
```

The `batch1.js` / `batch2.js` / `batch3.js` filenames are storage only. Nothing
reads them for order any more — `server/exercises/index.js` sorts by the
curriculum and stamps each exercise with its `module` and `track`.

**An exercise id is three things at once**: its URL slug, its localStorage
progress key, and its name in the curriculum. That is why the rename from
`b1-01` happened in one pass together with the module structure, and why
`content/legacy-ids.js` exists — delete it and everyone who practised before the
rename silently loses their progress. Adding an exercise means adding it to a
module's `exercises` list too; the index throws at import if you forget, in
either direction.

A lesson's title lives in two places — `curriculum.js` for navigation, and the
file's own frontmatter. That is deliberate: nothing should have to parse 54
markdown files to render a sidebar. `test/curriculum.mjs` fails if they drift.

Each lesson's frontmatter keeps a `source` line range into the original
`batch*.md` notes. That is provenance, not a live pointer — it is what made the
extraction reviewable, and what resolved each exercise's lesson automatically.
The notes themselves are on their way out; four sections still have no lesson to
live in, and until those are placed, deleting the notes would lose them.

## Routes

Every URL comes from the curriculum, so there is no route that content does not
justify and no content without a route.

| URL | from | ships JS |
|---|---|---|
| `/` | hand-written | no |
| `/learn/` | `TRACKS` + `MODULES` | no |
| `/learn/<lesson>/` | `content/lessons/*.md` | no |
| `/modules/<module>/` | `MODULES` | no |
| `/reference/<page>/` | `content/reference/*.md` | no |
| `/dataset/` | the seed itself, via `inferSchema` | no |
| `/practice/` | the app | yes, all of it |
| `/sitemap.xml`, `/robots.txt` | `allPaths()` | n/a |

Reading pages ship **zero JavaScript** — that is Astro's whole reason for being
here, and it is what keeps Core Web Vitals free. Keep it that way.

`/dataset/` is generated from `ecommerce.build()` rather than written by hand.
The original notes described the data in prose, and prose goes stale the moment
the generator changes.

**The deep-link seam.** Lesson and module pages link to `/practice/#<exercise-id>`,
and `app.js` opens that drill on load and on `hashchange`. This is the one join
between the static pages and the app, and it fails *silently* — the page still
renders, the link still resolves, the drill just does not open. `test/links.mjs`
checks every such hash names a real exercise; `test/dom-smoke.mjs` checks the app
end honours it.

Body class decides layout: `app` is the fixed three-pane shell that must not
scroll, `doc` is a normal document that must. One inheriting the other's rules
breaks both.

## Tests

| command | needs | what it proves |
|---|---|---|
| `npm test` | nothing | curriculum, examples, contrast, browser grading, DOM wiring |
| `npm run test:links` | a `dist/` build | no dead links, unique titles, real descriptions |
| `npm run test:island` | a `dist/` build | the runnable examples work on the real built markup |
| `npm run test:mobile` | a `dist/` build, Chrome | no page scrolls sideways at 360px, and the pane switcher is visible |
| `npm run verify` | nothing | build, then all of the above |
| `npm run conformance` | a local `mongod` | mingo agrees with real MongoDB |
| `npm run selfcheck` | a local `mongod` | every solution passes on the driver |

`npm test` is the one that runs everywhere; the last two need a database.

`test/examples.mjs` is the one that earns its keep on content changes. It runs all
73 runnable examples and fails on any that throws **or that returns nothing** -
`null`, `[]`, or a write with `matchedCount: 0`. The second half is why it exists:
an example that queries `{ _id: 1 }` against a collection whose ids start at 101
is not broken code, it is a broken lesson, and it looks completely fine in review.

`test/curriculum.mjs` is the cheap one worth knowing about: it catches the
mistakes that produce a dead link or lost progress rather than a stack trace —
a duplicate slug, a drill in no module, two lessons written from the same lines,
or a drill whose lesson lives in a *later* module (a prerequisite violation the
learner would hit as "how was I supposed to know that?").

## Runnable examples

A lesson is a static page that happens to be runnable. The pieces, in order:

1. `engine/runnable.js` — the rule. A fenced block is runnable if it is `js` and
   opens with `db.<collection>.` naming a collection the dataset really has.
   Everything else — `{ $group: { _id: "$x" } }`, `$gt // greater than`, a
   pipeline with `/* stage 1 */` in it — is a teaching fragment, and offering to
   run those is how the feature would look broken on its best pages. Escape hatch
   for a `db.`-shaped block that is still pseudo-code: ` ```js no-run `.
2. A Shiki transformer in `astro.config.mjs` puts `data-runnable` on the matching
   `<pre>`. It is done there because that is the one place with the raw source,
   the language and the fence's info string all in scope.
3. `src/components/RunnableExamples.astro` carries the `<script>` and nothing
   else, so a page can decide not to render it and stay scriptless.
4. `src/scripts/runnable.js` builds every control at runtime. Nothing about the
   toolbar exists in the HTML, so a page with the script blocked is exactly the
   code block it always was — and the code itself is read out of the `<pre>` with
   `textContent` rather than duplicated into a data attribute.

Two decisions worth not undoing:

**The engine is behind a dynamic import.** The eager stub is 1.7 KB gzipped; mingo
plus the dataset is 36 KB and loads on the first Run. Making that static would put
36 KB on 56 reading pages to serve the minority who press the button.

**One dataset per page, shared by every block.** A lesson on `$set` writes, and
the `find` below it should show the write — that is the truth about a database.
Rebuilding per block would teach that updates do nothing. The cost is that a write
persists across the page, so the result meta says so and offers to restore it.

## Traps already hit — don't re-introduce these

**A surface token is not automatically a visible surface.** The mobile pane
switcher was `--panel` on a `--bg` page, which is 1.08:1 - correct by the token
system and invisible to a person, who then never found two of the three panes.
`test/contrast.mjs` did not catch it because every rule in it is about text on a
background; nothing asked whether a *control* could be seen. `test/mobile.mjs`
asks now, at the 3:1 WCAG 1.4.11 bar for non-text contrast.

**Any author rule that sets `display` defeats the `hidden` attribute.** Author
styles beat the user-agent sheet whatever the specificity, so
`.dirty { display: inline-flex }` made `<span hidden>` visible and the "data
modified" bar sat in the toolbar permanently - the exact thing the comment next to
it says it must not do. `[hidden] { display: none !important }` at the top of
global.css is the fix, and it has to stay above everything that sets a display.

**Astro caches rendered markdown between builds.** Change the rule in
`engine/runnable.js` and only the files whose mtime also changed get re-rendered
through it. The build succeeds, prints 74 pages, and ships 6 marked pages instead
of 26. Clear `.astro/` and `node_modules/.astro/`, or trust the check in
`test/links.mjs` that compares the built HTML against the rule — which is there
because eyeballing a green build did not catch this.

**A freshly created `<textarea>` is not hidden.** The island's `code()` returns
the editor's value when the editor is visible and the block's text otherwise, so
reading it *after* creating the editor returned an empty string — the first Edit
click emptied the query. Capture the code before creating the element.
`test/dom-runnable.mjs` covers it.

**mingo's operators only register from the package root.** `import { Query } from
'mingo/query'` gives you a Query class with an empty operator table and every
filter dies with "unknown query operator $eq". Import from `'mingo'`.

**`mingo/updater` has no default export in its ESM build.** A default import
works under Node's CJS interop and silently breaks the browser bundle. Use named
imports.

**Express and Astro cannot share a dependency tree.** Express 4 pulls
`cookie@0.7.x`, npm hoists it, and it shadows the `cookie@2` Astro needs — same
name, incompatible API (`parse` vs `parseCookie`). The site build fails with what
looks like an Astro bug. This is why the express server was moved to
`local-mode/` and dropped from dependencies. When local mode is built it needs
its **own package.json** (npm workspace).

**Tied sort keys make exercises non-deterministic.** MongoDB does not define an
order for documents with equal sort keys, so any exercise sorting by a field
with duplicates can grade a correct answer as wrong. `ecommerce.js` now derives
each order's time-of-day from `(n * 7) % 1440` minutes so no two orders share a
`createdAt`. Keep any new sortable field unique.

**`node:vm` is not a sandbox and does not exist in browsers.** `engine/run.js`
uses `new Function` + `with` instead, which stays sloppy-mode even when called
from strict ESM. There is no security boundary and none is needed: the code runs
in the user's own tab against their own in-memory data, exactly like devtools.
This is precisely why hosting is safe — and why a hosted server that ran user
code, or accepted a user's connection string, would not be.

**Vite does not discover dynamically-imported packages.** Prettier loads only
when someone clicks Format, so Vite never sees it while scanning. The first
click then triggered a dependency re-optimisation and the in-flight import died
with "error importing dynamic module" — once, until a reload fixed it. Anything
reached *solely* through a dynamic `import()` must be listed in
`optimizeDeps.include` in `astro.config.mjs`. Dev-server only; the production
build already code-splits it correctly, which is why the build looked fine.

**`location` and `history` are browser globals, not Node ones.** The deep-link
handling threw on import under jsdom until the test harness defined them. Any
bare global the app touches has to be added to `test/dom-smoke.mjs`, or the test
fails for a reason that has nothing to do with the code being wrong. Related:
jsdom has no `scrollIntoView`, so that call is optional (`?.()`) — it is
cosmetic and must never be why a link fails to open.

**The shipped site depends only on `mingo`.** `mongodb` and `jsdom` are dev-only.
If the runtime dependency list grows, something has leaked from `server/` into
`engine/` or `src/`.

## Grading

The reference solution is executed live against the same data as the submission
and the two results are diffed — expected answers are never hardcoded, so they
cannot rot when the seed changes.

In the browser a "reseed" is just `dataset.build()`, so grading always runs on a
throwaway copy. A learner's playground can never affect grading, and grading can
never disturb their playground.

Solutions ship inside the bundle. Client-side grading makes that unavoidable;
the repo is open source so they are public anyway. "Show solution" stays behind
a confirm as a speed bump, not a barrier.
