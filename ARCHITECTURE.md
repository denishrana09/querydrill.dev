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

`content/topics.js` is the other closed vocabulary: every tag a drill or a
lesson may carry, in one list. Drills are checked against it at import in
`server/exercises/index.js`; lesson `operators` frontmatter is checked by the
collection schema in `src/content.config.mjs`. Before it existed the two sides
had separate, free-form vocabularies — which is how `sort` and `$sort` both came
to exist, and how the arrays lesson came to declare `$contains`, an operator its
own prose says is not real, into the JSON-LD `teaches` property.

Two rules live in that file and are enforced by `test/topics.mjs`:

- **A tag must not restate the structure.** `aggregation` was on 23 of 38 drills
  and was byte-identical to "track is not fundamentals"; `find` + `update`
  partitioned the fundamentals track exactly. `track` and `module` already carry
  that, and they are real pages.
- **A tag becomes a clickable filter only if it crosses a module and has 3+
  drills.** 32 of the original 43 never left one module, and for those
  `/modules/<slug>/` is the same filter with prose around it. The filter list is
  *computed* from that rule rather than listed, so it cannot drift from the
  content; the test prints which tags are one drill short, so growth is a prompt
  rather than a surprise.

The practice list filters by those promoted tags. The row is built from
`filtersFor(EXERCISES)` rather than listed in the markup, so it cannot disagree
with the drills. Card chips are **not** clickable and are styled so they do not
look it — filled and borderless, where the outlined pill is reserved for things
you can press. Making all 56 clickable would have left 49 controls that return
the one drill you were already looking at, which is the original complaint moved
rather than fixed.

What is deliberately *not* merged: `sort`/`$sort`, `projection`/`$project` and
`.skip()/.limit()`/`$skip` are cursor methods versus pipeline stages. Same goal,
different mechanism, and treating them as interchangeable is a mistake learners
make on their own. They keep separate tags, and the cursor-side labels carry the
syntax you type so the pair does not read as a typo.

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
| `npm test` | nothing | curriculum, tags, prompts, examples, contrast, browser grading, DOM wiring |
| `npm run test:links` | a `dist/` build | no dead links, unique titles, real descriptions |
| `npm run test:island` | a `dist/` build | the runnable examples work on the real built markup |
| `npm run test:editor` | a `dist/` build, Chrome | CodeMirror really mounts, colours from the tokens, brackets, indent, Ctrl+Enter, Format+undo |
| `npm run test:mobile` | a `dist/` build, Chrome | no page scrolls sideways at 360px; the pane switcher and topic filters are visible and thumb-sized |
| `npm run verify` | nothing | build, then all of the above |
| `npm run conformance` | a local `mongod` | mingo agrees with real MongoDB |
| `npm run selfcheck` | a local `mongod` | every solution passes on the driver |

`npm test` is the one that runs everywhere; the last two need a database.

`test/examples.mjs` is the one that earns its keep on content changes. It runs all
73 runnable examples and fails on any that throws **or that returns nothing** -
`null`, `[]`, or a write with `matchedCount: 0`. The second half is why it exists:
an example that queries `{ _id: 1 }` against a collection whose ids start at 101
is not broken code, it is a broken lesson, and it looks completely fine in review.

`test/result-value.mjs` holds one rule both of those share: whether a result is
worth showing a learner at all. A query that parses, runs, throws nothing and
returns `[]` is the failure that survives review. On a lesson the reader presses
Run and sees nothing. On a drill it is worse — the grader compares the learner's
result against the reference solution's, so an empty expected answer means an
empty answer *passes*, and so does any wrong answer that also finds nothing.
Lesson examples were checked for this from the start; drills were not, until
adding one by following CONTRIBUTING.md produced a drill that passed while
matching nothing.

`test/editor.mjs` is the one that cannot be replaced by a cheaper test. jsdom
answers every measurement with zero, so `src/scripts/editor.js` declines to mount
CodeMirror there and `test/dom-smoke.mjs` drives the textarea fallback instead.
That fallback is real — it is what a failed chunk load leaves behind — but it is
not what almost anybody gets, so without a real browser "the editor silently never
upgrades" is a bug that passes every other suite. Everything it asks is asked
through the keyboard, because auto-closing brackets and auto-indent only exist in
response to real input events; assigning a value would prove none of it.

`test/chrome.mjs` is the shared plumbing underneath it and `test/mobile.mjs`:
Astro's own preview server, a Chrome or Edge already on the machine, and the
WebSocket client Node has had since 22. No new dependency, and no browser found
means *skipped*, never a pass.

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

**The engine is behind a dynamic import.** The eager stub is 1.8 KB gzipped, 2.5 KB
with Vite's preload helper; mingo plus the dataset is 36 KB and loads on the first
Run, and the editor another 169 KB on the first Edit. Making any of that static
would put it on 56 reading pages to serve the minority who press the button.
`test/links.mjs` holds a gzipped budget over each page's static import graph, so
one misplaced top-level `import` cannot quietly undo this.

**One dataset per page, shared by every block.** A lesson on `$set` writes, and
the `find` below it should show the write — that is the truth about a database.
Rebuilding per block would teach that updates do nothing. The cost is that a write
persists across the page, so the result meta says so and offers to restore it.

**A ratio is not a percentage.** `inferSchema` reports field presence as 0-1;
`src/pages/dataset.astro` compared it against 100. Every field therefore tested as
"< 100", so the page whose entire purpose is showing which fields are optional
rendered all 31 of them optional, showed "1%" where it meant "always", and told
readers `discount` is "present on 1% of documents". `src/scripts/app.js` had it
right (`presence * 100`), which is exactly why nobody noticed - the sidebar looked
fine. `test/links.mjs` now checks the built page against the real data.

**A prompt must not out-give its own hint.** The help ladder is Hint -> scaffold
-> solution, and several prompts handed over the method before the first rung:
the capstone listed all six pipeline stages in order, which *is* what its scaffold
shows. State the problem in the prompt; put the method in the hint.

**Everything a learner reads has to survive arriving from a search result.** Four
drills pointed at "the notes" and "the end of Batch 3" - the private markdown in
`batch*.md` that the lessons were extracted from. Invisible to anyone who had read
them. `test/curriculum.mjs` fails on any prompt, hint or title that does it again.

## The editor

`src/scripts/editor.js` is the only thing on the site that knows what the editor
is. The practice app and the lesson-page Edit button both hold a handle from
`attachEditor()` — `value`, `insert`, `focus`, `refresh`, `el` — and neither of
them can tell which editor is behind it.

**The `<textarea>` in the markup is the editor, not a placeholder for one.**
CodeMirror replaces it when its chunk arrives, carrying the value, the selection
and the classes across. That is not politeness about old browsers: it keeps the
one thing the editor already did well, which is that it is simply *there*, and it
means a failed chunk load leaves a working editor rather than a dead box. The
practice page attaches on load; a lesson page attaches on the Edit click, so a
reader who reads downloads none of it.

**The colours are the `--syn-*` tokens the results pane already uses**, not values
baked into a CodeMirror theme object. Both themes then work with no extra code,
`test/contrast.mjs` was already checking those five values, and a string you type
is the same orange as the string that comes back. The only decision in the JS is
which token each kind of token gets; every box, font and padding is in the
stylesheets, next to the rules it has to match. The distinction that earns its
keep is `$group` the key against `"$items.product"` the string — a colour apart,
and a mistake people actually make.

**The two hosts share one class.** `query-box` on the practice page, `rx-editor`
on a lesson page; `attachEditor` copies whatever is on the textarea onto
CodeMirror's root, plus `cm-host` for the parts only CodeMirror has. So the pane
geometry is written once and the swap cannot change the size of anything.

Deliberately left out: line numbers and an active-line highlight. These queries
are five lines, and in the three-column layout the editor pane is 368px wide — a
gutter would spend a tenth of that on counting to five. Also no `drawSelection`:
the browser's own caret and selection are correct, themeable from CSS, and one
less thing to keep contrast-tested.

## Traps already hit — don't re-introduce these

**A test must not import the threshold it is checking.** `test/topics.mjs`
asserted that every filter chip had `MIN_FILTER_DRILLS` drills behind it — and
imported `MIN_FILTER_DRILLS` from the module it was checking. Lowering the
constant to 1 passed that check while putting three 2-drill chips in the filter
row: the test only ever proved the module agreed with itself. The floor is now
written out as a literal in the test, so changing the policy has to fail and be
argued for. This was found by deliberately breaking the check, which is the only
reason it was found at all.

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

**The shipped site's runtime dependencies are `mingo`, `prettier` and CodeMirror.**
`mongodb` and `jsdom` are dev-only, and all three runtime ones are behind dynamic
imports. If anything new appears in `dependencies`, check it is lazy before it is
merged — the budget in `test/links.mjs` is what makes that answerable.

**A check that counts requests does not measure bytes.** The first version of the
"a lesson page has not downloaded an editor" check counted script resources. Vite
folds a small module into the chunk that imports it, so making the import eager
delivered the bytes with no new request and the check passed. It was replaced by
a gzipped budget over the static import graph in `test/links.mjs`.

**CodeMirror merges an un-isolated rewrite into the typing before it.** `Format`
replaces the whole document in one transaction, and by default the history lumped
that together with the keystrokes that preceded it — so the first Ctrl+Z after a
Format threw away the query as well as the formatting. The fix is
`isolateHistory.of('full')` on that transaction. Found because a comment claimed
"Format is undoable" and a test asked for exactly that.

**Anything CodeMirror measured while hidden is zero.** The mobile tab bar puts the
editor pane in `display: none`, and the caret lands in the wrong place when it
comes back. Hence `refresh()` on the handle, called from `showPane` and when a
lesson editor is unhidden.

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
