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

## Tests

| command | needs | what it proves |
|---|---|---|
| `npm test` | nothing | browser grading + DOM wiring |
| `npm run conformance` | a local `mongod` | mingo agrees with real MongoDB |
| `npm run selfcheck` | a local `mongod` | every solution passes on the driver |

`npm test` is the one that runs everywhere; the other two need a database.

## Traps already hit — don't re-introduce these

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
