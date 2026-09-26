# Roadmap

The single source of truth for turning this from a localhost practice tool into a
public, hosted, open-source MongoDB learning site. Update it as things land.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[>]` deliberately deferred

---

## Start here

**Done so far:** light + dark themes with a toggle, contrast-tested (§2). The
app runs entirely in the browser (§1). 38 drills audited so
starters show structure, never answer (§3). Content restructured into 3 tracks →
12 modules → 54 lessons (§3). 74 static pages with full SEO plumbing, sitemap,
JSON-LD and internal linking (§4). `npm run verify` builds and checks all of it.

**Next, in the order I would do it — nothing here is blocked, pick up at the top:**

1. **Runnable examples on lesson pages** (§4, the live-editor item). *The*
   differentiator and the biggest remaining gap. A lesson currently links to its
   drill; it does not let you run the example where you are standing. Every
   page-one Google result for `$lookup` is a Medium post you cannot run a query
   on — and so, right now, is ours. The engine is already browser-safe and the
   dataset builder is pure, so this is a compact editor + results island, not a
   second copy of the app.
2. **Responsive layout** (§2). The 3-pane grid is unusable on a phone and search
   traffic is majority phone. Paired with (1), this is what makes 54 pages worth
   having.
3. **Tag vocabulary cleanup, then chip filtering** (§2). See the measurements in
   that item before starting — the clicking is not the hard part.
4. **LICENSE + CONTRIBUTING** (§7). Small, and without a LICENSE the repo is not
   legally open source however the README describes it.

**Before any deploy**, read §8's blocker list first — `site:` is still
`https://example.com`, which poisons every canonical URL on every page.

**Working agreement:** go step by step and pause after each step for review,
rather than finishing everything and then reporting. Opinions and pushback are
wanted over compliance. Commits: short, human, one subject line, batched — never
one commit per file, and never any AI attribution trailer.

---

## 0. Decisions already made (don't relitigate)

| Decision | Why |
|---|---|
| Queries run **in the browser** via `mingo` | No backend, no DB, free static hosting, zero setup wall for learners |
| **No** hosted "paste your connection string" | `localhost` would mean *our* server; SSRF/open-proxy hazard; `node:vm` is not a sandbox |
| **Astro** | Content-heavy + one interactive island; prerendered per-lesson pages are the SEO strategy |
| Real MongoDB deferred to `npx` **local mode** | That's where a connection URI is safe and `localhost` means *their* localhost |
| Progress in **localStorage**, no accounts | Nothing to store, nothing to breach, no signup friction |
| Repo stays `mongodb-practice` for now | Rename on GitHub later — redirects preserve stars/links/history |

**Verified**: 38/38 exercises produce identical output on real MongoDB and mingo
(`npm run conformance`). Browser mode covers the entire current exercise set.

---

## 1. Foundation

- [x] `engine/mingo-db.js` — in-memory `db` shim, API-compatible with the driver shim
- [x] `engine/run.js` — browser-safe runner (`new Function` + `with`, no `node:vm`)
- [x] `test/conformance.mjs` — dual-engine test, `npm run conformance`
- [x] Fix tied `createdAt` values in seed data (made two exercises non-deterministic)
- [x] Implement upsert in the mingo shim
- [x] Astro scaffold + repo layout (`engine/` `src/` `server/` `content/` `local-mode/`)
- [x] Port the UI to the browser engine; fetch-based API layer deleted from the client
- [x] Dataset + exercises importable from the browser bundle
- [x] `engine/compare.js` — grading rules shared byte-for-byte by both engines
- [x] `test/browser-grade.mjs` + `test/dom-smoke.mjs` — `npm test`, no services needed
- [ ] GitHub Actions: conformance test against a real `mongo:7` service container
- [x] Bundle-size check — full app is **45.7 KB gzipped** (budget ~250KB)

---

## 2. UI / UX

- [ ] **CodeMirror 6** replacing the `<textarea>` — JS syntax highlighting, bracket matching, auto-indent
- [ ] Autocomplete for collection names and `$` operators (big perceived-quality win)
- [ ] **Responsive layout** — the 3-pane grid is unusable on a phone, and Google will send phones
- [x] **Light theme + a toggle.** This item used to say "dark mode", which was
      backwards — the site was dark-only, and that was the complaint. Done
      2026-09-26. Defaults to `prefers-color-scheme`, the toggle overrides it,
      the choice is remembered, and the OS is still followed live until someone
      actually clicks. What it took:
      - Every colour is now a token. ~25 hardcoded values had escaped (the
        results-pane JSON highlighting, `#3d4657` as a hover border in four
        places); a hex outside the `:root` blocks is now a bug by definition.
      - `data-theme` is written by a **blocking inline script** in `Base.astro`
        before first paint. Applying it later is a white flash on every
        navigation, which is worse than no toggle. Inline also means the pages
        that ship zero JavaScript still ship zero bundled JavaScript.
      - Shiki emits **both** themes per token (light inline, dark as
        `--shiki-dark`); `doc.css` swaps them. Overriding an inline style needs
        `!important` — that is the documented path, not a hack.
      - `test/contrast.mjs` parses both palettes out of `global.css` and checks
        every foreground against `--bg`, `--panel` *and* `--panel-2`. It caught
        three tokens below AA that eyeballing had passed, and it fails if the
        two palettes ever stop defining the same tokens.
- [ ] Results pane: table view toggle alongside raw JSON
- [ ] Keyboard shortcuts, discoverable (`Ctrl+Enter` run, `Ctrl+/` comment)
- [ ] Loading/empty/error states that don't look broken
- [x] Schema sidebar: collection -> field names + types, click-to-insert dotted path.
      Replaced the raw sample document, which needed two scrollbars and — worse —
      made optional fields look mandatory. Now shows presence percentages, so
      `discount 57%` / `rating 50%` are visible facts rather than a hidden trap
      the $ifNull drills spring later.
- [x] "Reset data" — only appears once a query has actually written something.
      A permanent button implied a problem that rarely exists; grading always
      runs on a throwaway copy, so a dirty playground can never mis-grade.
- [x] Editor/results drag splitter, keyboard-accessible, position persisted.
      The old `resize: vertical` handle did nothing: `flex: 0 0 34%` overrode
      the height it set.
- [x] Remove the internal `batch1.md:197` note reference from the exercise UI
- [x] Replace the raw `b1-01` ids in the UI with topic + difficulty chips.
      Done with the content model, in one pass, as planned: the id is now the
      URL slug *and* the progress key, so it could only be changed once.
      A coloured dot carries difficulty in the list (scannable down 38 rows
      without competing with the title); the word plus topic chips appear in the
      opened card. `content/legacy-ids.js` migrates existing localStorage.
- [ ] **Make the tag chips do something.** They currently render in two places
      and neither is clickable — on the practice card (`app.js`, difficulty +
      topics) and on lesson pages (`learn/[slug].astro`, operators). A chip that
      looks like a control and is not is worse than no chip.
      **Fix the vocabulary first — clicking is not the hard part.** Measured
      2026-09-26 across the 38 drills:
      - 43 tags total, and **29 of them match exactly one exercise**. Clicking a
        tag to be shown the one thing you were already looking at is worse than
        it not clicking; as pages, that is 29 thin pages, which is the same
        padding this project criticises MongoPractice for.
      - `sort` and `$sort` both exist. Same concept, two spellings, a mistake in
        the original tag table.
      - `aggregation` is on **23 of 38** exercises — useless as a filter and a
        duplicate of `/learn/` as a page.
      Order of work: normalise the vocabulary (one spelling, drop `aggregation`
      as noise, fold singletons into their parent concept) → chips filter the
      practice list client-side → topic *pages* only for the ~12 tags with real
      volume (`$group` 11, `find` 9, `arrays` 9, `update` 6, `$unwind` 5,
      `$lookup` 4), which are also the long-tail keywords worth ranking for.
- [ ] Copy-query and share-a-permalink button (query encoded in URL hash)
- [ ] Progress indicator: X/38 solved, per-topic breakdown
- [ ] Favicon, OG image, 404 page
- [ ] Take **UI inspiration** from MongoPractice's layout (topic sidebar, difficulty
      chips, list controls) — but do not copy it verbatim

---

## 3. Content

The notes are ~5,200 lines across `batch1.md` / `batch2.md` / `batch3.md`. The
problem is not depth, it's delivery — nobody reads a wall of markdown on GitHub
and then comes back to practice.

- [x] **The content model** — `content/curriculum.js`, the single source of truth
      for ordering and for every URL. 3 tracks -> 12 modules -> 54 lessons ->
      38 drills. Modules are 2-6 drills on one idea, so a module is a sitting.
      `test/curriculum.mjs` (in `npm test`) enforces it: unique URL-safe slugs,
      every drill in exactly one module, no lesson written from lines another
      lesson already claims, and **no drill pointing at a lesson from a later
      module** — that check moved `average-per-month` out of *Grouping*, since
      it needs `$month`, which the date lesson had not taught yet.
- [x] Each lesson maps to its exercise(s) — resolved automatically from the old
      `noteRef` line anchors against the lesson source ranges, then `noteRef`
      deleted. 35 of 38 resolved on their own; the 3 that did not pointed at the
      pattern/self-test appendices, which became reference pages, not lessons.
- [x] **Split the notes into 54 lesson files** — `content/lessons/<slug>.md`,
      plus 4 pages in `content/reference/`. Each carries frontmatter: title,
      module, track, SEO description, the operators it teaches, and the line
      range of the original notes it came from.
- [x] **Rewrite the prose for strangers.** Every lesson now opens with a
      paragraph that stands alone — the notes opened mid-thought (`Suppose:`,
      `Given:`, `This is basically:`) because they were written to be read in
      one pass. 17 one-line fragments the new openings replaced were deleted,
      and 5 promises of chapters that do not exist ("we'll revisit this during
      indexing") were replaced with the actual answer. The voice stays.
- [ ] **Delete `batch1.md` / `batch2.md` / `batch3.md`** — blocked, not done.
      Four sections have no home yet, and deleting would lose them:
      - `batch2.md:31-115` — **the dataset description**. This is the biggest
        gap: §6 wants the dataset explained up front and there is no page for it.
      - `batch2.md:1837-1952` — "Quick Self-Test", 4 ready-made exercises.
      - `batch1.md:1183-1284` — "Mini Interview Questions", ~5 more.
      - `batch2.md:1320-1464` — a second full worked example.
      The rest is `# Batch N` preamble and can go. Everything else is migrated;
      re-check with the gap script before deleting.
- [x] **Lesson, module and reference pages exist and are linked.** 74 pages.
      `/learn/<lesson>/`, `/modules/<module>/`, `/reference/<page>/`, plus
      `/dataset/`. Reading pages ship zero JavaScript.
- [x] **The dataset page** — generated from `ecommerce.build()` and `inferSchema`,
      so it can never drift from what the app actually loads. Shows field types,
      presence percentages and a sample document per collection, and calls out
      the deliberately-optional fields the `$ifNull` drills depend on.
- [ ] Render lessons **in-app** beside the editor as well, so a drill and its
      lesson can be read side by side without leaving the practice page
- [ ] Every lesson gets a runnable example, pre-filled into the editor in one click
- [ ] **Rewrite problem descriptions** for a worldwide audience:
      - state the goal, the collection, and the exact expected shape
      - no assumed context from having read the notes end to end
      - say explicitly when order matters vs doesn't
- [x] **Starter-code audit — starters show structure, never answer.**
      Measured 2026-09-03: starters give away an average **56%** of their own
      solution, and **24 of 38** give away over half. Worst offenders:
      `b3-01 $lookup` 89%, `b2-01 $match then $sort` 88%, `b2-08` 85%,
      `b1-08` 83%. In `b3-01` the learner types only `userId` and `_id` into a
      `$lookup` stage someone else built — they have not learned `$lookup`, and
      in an interview they face an empty editor and cannot produce the stage.
      `b1-01` is the model to copy at 33%: shape given, content withheld.
      - Rewrite all 38 to the rule; thinner starters mean the prompt must carry
        more, so this pairs with the description rewrite above.
      - Add a per-exercise **"more structure"** button so lowering the default
        does not strand beginners.
      - DONE 2026-09-03: all 38 rewritten. Average give-away **57% -> 26%**;
        exercises over 50% went from 24 to 1 (b1-15, a measurement artifact of a
        very short solution, not a real giveaway).
      - Batch 1: call + empty argument slots.
      - Batch 2: blank pipeline - choosing the stages and their order is the lesson.
      - Batch 3: stage skeleton with empty bodies - these problems are long enough
        that inventing the shape AND the contents is two exercises in one.
        Scalar stage bodies (`$limit: 5`) stay filled; they are stated in the prompt.
      - b3-13 keeps its blank pipeline (it was already 7%) with the 9-stage
        skeleton demoted to its scaffold. Never let the audit make one *easier*.
      - Old starters were kept as `scaffold` behind the help ladder, so nothing
        was thrown away - it just stopped being the default.
- [x] Difficulty tags — honest ones: **12 easy, 16 medium, 10 hard**. Validated
      only as "not all one value"; the calibration is a judgement call and worth
      revisiting once real people have attempted them.
- [x] Topic tags per exercise (`find`, `$group`, `$lookup`, `update`, …).
      Not yet wired to a filter UI — that is the next §2 item.
- [x] A defined **learning track**: tracks -> modules -> ordered drills, and the
      practice list now renders in that order instead of by batch file.
- [ ] **Thin modules, to fill honestly.** The structure exposed where coverage is
      one drill deep: *Documents and find()* (1), *Sorting and pagination* (1),
      *The aggregation pipeline* (2). Sorting especially deserves three. This is
      the good kind of growth — a real gap, not padding to hit a number.
- [ ] **Two views over one content set** (not two content sets):
      - *Guided* — lesson -> its drill -> next lesson. Default. For beginners.
      - *Module* — read 4-6 lessons straight through, then drill 5-8 exercises as
        a queue. How experienced engineers prefer to learn: build the whole
        mental model first, then practice.
      Same lessons, same exercises; only the practice checkpoint moves. So it is
      one extra page template, not double the content.
      - The module page doubles as the **SEO hub page** (§4 hub-and-spoke), so
        this costs almost nothing extra.
      - Do **not** fork on first visit - default to guided and put a visible
        affordance on each view pointing at the other.
      - [x] Regroup the 3 oversized batches into modules. Landed as 12, in 3
        tracks. The map is `content/curriculum.js` - read it there rather than
        copying it here, so there is only one place to be wrong.
- [ ] Grow past 38 exercises — but **never pad**. One concept = one exercise.
      MongoPractice claims "530 problems" that are `SKU-1021`…`SKU-1025` style
      generated duplicates; not matching that number is a feature, not a gap.
- [ ] "Common mistakes" note per exercise, shown after a failed attempt
- [ ] Cheatsheet page (operator → one-line meaning → link to its lesson).
      Four **reference pages** are already mapped in `content/curriculum.js`,
      built from the appendices the lessons did not absorb: the operator
      cheatsheet, "how to think about a pipeline", common mistakes, and the
      `$match` vs `$filter` / `$project` vs `$map` / `$group` vs `$reduce`
      comparisons. That last one is strong long-tail SEO on its own.
- [ ] The unmigrated self-test sections are ~9 ready-made exercises — the
      cheapest honest way to grow past 38. See the deletion item above.

---

## 4. SEO

The brand name will bring almost nothing. Lesson pages bring the traffic.

- [x] **One prerendered URL per lesson** — 54 of them, fully server-rendered.
      Plus 12 module hubs and 4 reference pages. 74 pages total.
- [>] One URL per exercise. Deferred, not skipped: drills are deep-linked as
      `/practice/#<slug>` today, which is one page, not 38. A real per-exercise
      page is worth doing once there is a reason for it to rank on its own.
- [ ] Target **long-tail operator keywords**: "mongodb $unwind example",
      "mongodb $lookup tutorial", "mongodb aggregation practice"
- [ ] Do **not** fight head terms — W3Schools/GeeksforGeeks own "mongodb exercises"
- [ ] **The differentiator: a live editor on the lesson page itself.** Page-one
      results for `$lookup`/`$unwind` are Medium posts, YouTube and vendor blogs,
      and *none of them let you run the query*. Right now a lesson links to the
      drill; it does not let you run the example in place. This is the single
      highest-value remaining SEO item and it is not done.
- [x] Unique `<title>` + `<meta description>` per page — enforced, including
      the no-duplicate-titles check, by `test/links.mjs`
- [x] JSON-LD: `LearningResource` per lesson, `Course` per module, `ItemList`
      on the index, `Article` on reference pages
- [x] `sitemap.xml` + `robots.txt` — generated from `allPaths()`, so a page that
      is not part of the curriculum never gets advertised
- [x] Canonical URLs (already enforced by `Base.astro` for every page)
- [x] OG/Twitter cards per lesson — via `Base.astro`; still needs a real
      `og-default.png`, which does not exist yet
- [x] Internal linking: lesson → its module → its drills → back to the lesson,
      prev/next through the whole course, and `test/links.mjs` proves every
      exercise is reachable from at least one page
- [x] Core Web Vitals — verified: reading pages ship **zero JavaScript**
- [ ] Plausible or Umami analytics (privacy-friendly, no cookie banner needed)
- [ ] Submit to Google Search Console + Bing Webmaster Tools

---

## 5. Positioning — "why this site"

Landing page must answer this in one screen. The honest differentiators, ranked:

1. **Field-level feedback.** Everyone else says right/wrong. This says
   `row 0.revenue: expected 53000, got 27000`. Nothing else found does this —
   *lead with it everywhere*: landing page, README, LinkedIn post.
2. **No signup, no install, no setup.** Click and type.
3. **Graded against a live reference solution**, not hardcoded JSON — expected
   answers can't rot when the seed changes.
4. **Open source.** Exercises are contributable.
5. **Real hand-written exercises**, each a distinct concept. No generated padding.

- [ ] Landing page communicating the above, with a working editor on it
- [ ] A comparison section — factual, not snide, no competitor names needed
- [ ] "How it works" explaining browser execution and why nothing is uploaded
- [ ] Visible **"Coming soon"** strip: connect your own MongoDB, `explain()`,
      index tuning — via local mode

---

## 6. Onboarding / how to use

- [ ] First-visit guided path — land people *in* an exercise, not on a menu
- [ ] Explain the dataset up front (users / orders / products, with schemas)
- [ ] Make it obvious data is in-browser, resettable, and never uploaded
- [ ] Hints are already per-exercise — surface them progressively, not all at once
- [ ] "Show solution" stays gated behind an attempt (it already is server-side; keep
      that intent client-side)
- [ ] Empty editor should suggest something runnable, not sit blank

---

## 7. Repo / OSS hygiene

- [ ] `LICENSE` — MIT (without it, "open source" isn't legally true)
- [ ] `CONTRIBUTING.md` — how to add an exercise, run conformance, submit a lesson
- [ ] Rewrite `README.md` for a public audience: screenshot/GIF first, then what it
      is, then local dev
- [ ] **"Not affiliated with MongoDB, Inc."** disclaimer in README + site footer
      (MongoDB Inc. is protective of the "Mongo" mark; don't use their leaf logo or green)
- [ ] Issue templates: bug, new exercise, wrong grading
- [ ] `good first issue` labels — exercise contributions are ideal for this
- [ ] CI badge + conformance badge
- [ ] Rename repo on GitHub once the name is chosen; then flip public

---

## 8. Launch

### Blockers — things that are actively wrong until fixed

Audited 2026-09-26. These are not polish. Each one is currently shipped-broken
in `dist/`, and the first is the kind of mistake that costs the whole SEO effort.

- [ ] **`site: 'https://example.com'` in `astro.config.mjs` poisons every page.**
      All 74 pages emit `<link rel="canonical" href="https://example.com/...">`,
      and the sitemap and every OG URL do the same. A canonical tells Google
      "this is the real address of this page", so right now all 74 declare a
      domain we do not own as authoritative. Changing the one line fixes all of
      them at once — but nothing can be deployed before it is changed, and a
      deploy that happens to go out first is worse than not deploying.
- [ ] **`/og-default.png` is referenced by `Base.astro` and does not exist.**
      Every share on LinkedIn, Twitter or Slack renders a broken image — which
      is most of the launch plan in §8. Needs a real 1200×630 image.
- [ ] **No `404.astro`.** A mistyped URL falls through to whatever the host
      shows, which is a dead end off-site rather than a way back into the course.
- [ ] **Sitemap has no `<lastmod>`.** It has `<priority>`, which Google ignores,
      and lacks the one field Google actually reads. Backwards. Wire it to the
      lesson files' mtime or the git commit date.
- [ ] Add a check to `test/links.mjs` that every referenced local asset exists —
      `og-default.png` was referenced for weeks and nothing noticed.
- [ ] Decide whether `example.com` should instead fail the build. A placeholder
      that silently produces valid-looking wrong output is the trap here.

### The rest

- [ ] Buy the domain, point at the host
- [ ] Deploy (Cloudflare Pages or Vercel — both free, static)
- [ ] Verify the whole thing works with JS-only, no backend, no env vars
- [ ] Lighthouse pass ≥ 95 on all four scores
- [ ] Test on a real phone
- [ ] Post: LinkedIn, r/mongodb, r/webdev, Hacker News (Show HN), dev.to
- [ ] Answer the MongoDB community forum thread where someone asked exactly for this
      (people finish M001 and ask "where do I practice?" — the best answer today is
      a sandbox with no exercises)

---

## 9. Deferred — after MVP

- [>] `npx` local mode: Express + real mongod, own connection URI, `explain()`, indexes
      — **must get its own package.json/workspace in `local-mode/`**. Express
      hoists `cookie@0.7.x`, which shadows the `cookie@2` Astro needs and breaks
      the site build. A Node server and the static site cannot share a dep tree.
- [>] Exercises for indexes and query plans (need local mode)
- [>] The `notes` dataset as a second seed option
- [>] Accounts / cloud-synced progress
- [>] i18n
- [>] Embeddable widget for blog posts
- [>] User-submitted exercises via a web form

---

## Open questions

- [ ] Final name + domain (deferred by choice; repo rename handles it)
- [ ] Cloudflare Pages vs Vercel
- [ ] Whether to keep the `notes` dataset at all, or fold its examples into lessons
