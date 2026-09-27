# Roadmap

The single source of truth for turning this from a localhost practice tool into a
public, hosted, open-source MongoDB learning site. Update it as things land.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[>]` deliberately deferred

---

## Start here

**Done so far:** a layout that works on a phone, checked in a real browser (§2).
Runnable examples on every lesson - 73 of them, Run/Edit/Copy against the real
engine (§4). Light + dark themes with a toggle, contrast-tested
(§2). The app runs entirely in the browser (§1). 38 drills audited so starters
show structure, never answer (§3). Content restructured into 3 tracks → 12
modules → 54 lessons (§3). 74 static pages with full SEO plumbing, sitemap,
JSON-LD and internal linking (§4). The tag vocabulary normalised into one closed
list, 43 tags down to 7 that earn a clickable chip (§2). The drill list filters by
topic (§2). Prompts audited and made safe for someone who has never seen the
source notes (§3). MIT licensed, with a CONTRIBUTING guide whose every instruction was
tested by following it (§7).
`npm run verify` builds and runs nine suites over all of it.

**Next, in the order I would do it — nothing here is blocked, pick up at the top:**

1. **CodeMirror 6** (§2), replacing the `<textarea>` in the app and the one the
   lesson examples swap in. The editor is where all the time is spent and it is
   the least finished thing on the site.
2. **Topic pages** for the 7 filter tags (§4) — the long-tail keywords, built on
   the filtering that already landed.
3. **A real README for strangers** (§7) — the false parts are fixed, but it still
   opens with prose instead of a screenshot, and there is no screenshot worth
   using until the landing page exists (§5).
4. **"Common mistakes" after a failed attempt** (§3). The content for several of
   these already exists — it came out of the prompts during the rewrite and is
   sitting in hints, which is not quite the right moment to show it.

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
- [x] **Responsive layout.** DONE 2026-09-26. Verified in a real browser, not by
      narrowing a window: all 74 pages fit 360px with no sideways scroll, and
      `npm run test:mobile` keeps it that way by driving headless Chrome over CDP
      and naming the widest offending element when it fails.
      - The app's three panes become three **views** below 880px, with a tab bar
        carrying the progress count. Stacking them would have buried the editor
        under a 38-item list and turned the fixed shell into a scrolling page.
      - That bar was redone after first contact with a real person, who did not
        find it. It was flush at the bottom in `--panel` on a `--bg` page -
        **1.08:1** - with grey 12px labels and a 2px underline on the active one:
        a real surface in the token set and invisible as one, so it read as a
        footer. It is now a floating pill with icons, a filled active segment and
        one slide-up on arrival. A hamburger was considered and rejected: it hides
        three destinations behind a tap and an icon people already ignore, and the
        problem was never the pattern - a bottom bar is the most discoverable
        mobile navigation there is - it was that mine whispered.
      - `test/mobile.mjs` now also fails if the selected tab drops below **3:1**
        against the page (WCAG 1.4.11, non-text contrast) or any tab below 44px.
      - Opening a drill switches back to the editor, or tapping an exercise on a
        phone looks like it did nothing.
      - `100dvh`, because `100vh` on a phone counts the address bar and puts the
        tab bar underneath it.
      - The editor toolbar wraps on a **container** query, not a media query: at a
        900px viewport the editor column is 368px, and only the pane knows that.
      - Bigger touch targets on the example buttons and the app toolbar.
      - Found and fixed on the way: `[hidden]` was being defeated by any rule that
        set `display`, so the "data modified" bar had been permanently visible on
        every screen size, desktop included.
      - Lesson worth keeping: every contrast rule in this project was about *text*.
        Nothing checked whether a **control** was visible, and that is the failure
        that actually reached a user.
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
- [x] **Make the tag chips do something.** DONE 2026-09-27. Vocabulary first,
      then the filtering. The complaint was that chips render in two places and
      neither is clickable — a chip that looks like a control and is not is worse
      than no chip. Resolved by splitting the two jobs rather than by making all
      56 tags clickable: **filters are a row of their own** above the drill list,
      styled as controls; **card chips stay labels**, and now look like labels
      (filled, borderless — the outlined pill they used to be *is* what a button
      looks like here). Only 7 tags are worth filtering by, so making every chip
      clickable would have left 49 dead-looking controls, which is the same bug
      in a new place.
      **The vocabulary had to go first**, and it is now `content/topics.js`: one
      closed list, checked at import for drills and by the collection schema for
      lessons, so a second spelling of an existing idea cannot appear again.
      - 43 tags over 38 drills, **29 of them on exactly one drill**.
      - `aggregation` was on **23 of 38** and proved *byte-identical* to "track is
        not fundamentals"; `find` + `update` partitioned the fundamentals track
        exactly, 9 and 6, no overlap. Those were the `track` and `module` fields
        spelled a second time somewhere nothing kept them in step. `aggregation`
        is gone. `find`/`update` stay — read-vs-write is worth filtering on, and
        neither is a page that already exists.
      - **32 of the 43 never left a single module.** For those, `/modules/<slug>/`
        is already that filter and it has a title, a goal and prose. So a tag is
        promoted to a clickable filter only if it crosses a module *and* has 3+
        drills behind it: **7 chips** today — `$group` 11, `find()` 9, `arrays` 9,
        `update` 6, `$unwind` 5, `$lookup` 4, `$map` 3, reaching 33 of 38 drills.
        The remaining 49 tags stay labels, and now have to *look* like labels.
      - **This item used to say `sort`/`$sort` were "the same concept, two
        spellings, a mistake in the original tag table". That was wrong.** They
        are the cursor method and the pipeline stage — as are `projection` and
        `$project`, and `.skip()/.limit()` and `$skip`/`$limit`. Merging them
        would have taught that they are interchangeable, which is a mistake
        people actually make. They stay separate, and the cursor-side ones carry
        the syntax you type, so `.sort()` next to `$sort` reads as a distinction
        instead of a typo. `facet-pagination` was carrying the cursor
        `pagination` tag while using the stages; retagged.
      - Found on the way: the arrays lesson declared **`$contains`** among the
        operators it teaches — an operator its own prose says does not exist —
        and that field becomes the JSON-LD `teaches` property. Every build was
        telling Google we teach an imaginary operator. Lessons now validate
        against the same closed list, so the free-form string array that allowed
        it is gone.
      - `test/topics.mjs` — 11 checks, in `npm test` — holds the line: no dead
        tags, no tag restating a module or any combination of tracks, every
        operator tag present in its own drill's solution, and the filter row
        bounded so it cannot drift back towards 43 chips. It also prints which
        tags are one drill short of earning one, so growth past 38 drills is a
        prompt to look rather than a silent change to the UI.
      - Every check was proven to fail first: five deliberate breaks, including
        putting `aggregation` back on all 23 drills. One was **missed** and had to
        be rewritten — the filter-quality check imported the same constant it was
        validating, so lowering it passed while putting three 2-drill chips in the
        row. A test that imports its own threshold tests nothing.
      How the filtering behaves, and why:
      - **One topic at a time**, and clicking the active chip clears it, so All is
        not the only way back out. Multi-select was rejected: with 7 tags of 3-11
        drills, an AND is almost always empty and an OR is almost always the
        whole list.
      - **Not remembered between visits.** Returning to find two thirds of the
        course missing, because of a chip clicked last week, is a bug that looks
        like lost content.
      - **Empty modules and empty tracks disappear** with their headings. A
        heading with nothing under it reads as a module that lost its drills.
      - **Overall progress still counts the whole course**, not the filtered view.
      - **A filter that hides the open drill closes it** — but never touches the
        editor. Losing a half-written query to a filter click would be far worse
        than losing your place.
      - On a phone the row **scrolls sideways instead of wrapping**: eight
        thumb-sized chips wrap to three rows at 360px, which is 126px of filters
        above the first drill (measured, not guessed). `test/mobile.mjs` fails if
        it ever wraps, if it stops scrolling while clipping chips, or if a chip
        drops below 40px.
      - 12 checks in `test/dom-smoke.mjs`, all five deliberate breaks caught. One
        of them was rewritten after the break *passed*: it asserted the open card
        disappears, which happens anyway because a filtered-out drill is never
        rendered. The real consequence of not clearing `openId` is that the drill
        springs back open when the filter clears — so that is what it checks now.
      Still to do: topic *pages* for the tags with real volume — those are the
      long-tail keywords worth ranking for.
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
      `/dataset/`. Reading pages ship 1.7 KB of JavaScript, or none at all
      where there is no runnable example.
- [x] **The dataset page** — generated from `ecommerce.build()` and `inferSchema`,
      so it can never drift from what the app actually loads. Shows field types,
      presence percentages and a sample document per collection, and calls out
      the deliberately-optional fields the `$ifNull` drills depend on.
- [ ] Render lessons **in-app** beside the editor as well, so a drill and its
      lesson can be read side by side without leaving the practice page
- [x] **Every lesson gets a runnable example.** All 54 lessons plus 2 of the 4
      reference pages - 73 examples, run in place rather than pre-filled into
      the app, which turned out to be the better version of this idea: you never
      leave the lesson. The two pages without one are pure tables with no query
      on them to run, and `test/examples.mjs` names them rather than exempting
      reference pages as a class.
- [x] **Rewrite problem descriptions** for a worldwide audience. DONE
      2026-09-27 — and much smaller than this item assumed, because measuring
      first showed two of its three criteria were already met:
      - *State the goal, the collection, the exact expected shape.* The starter
        names the collection in **38 of 38**, so "the prompt never says the
        collection" was a defect in my audit, not in the prompts. Shapes were
        already precise.
      - *Say when order matters.* Every drill whose row order is graded and which
        returns more than one row already said so. Rather than add a sentence to
        the nine `unordered` prompts — nine more places to drift — the card now
        renders an **any order / order matters** chip from the same flag
        `engine/compare.js` reads. Write drills claim nothing: you return an
        update result, and their `verify` query fixes the order.
      - *No assumed context.* This was the real defect. Four places pointed at
        "the notes" and "the end of Batch 3" — the private markdown the lessons
        were written from, which no reader has ever seen. Invisible in review
        because whoever wrote them had read the notes.
      The other real finding: **several prompts gave away more than their own
      hint did**, which pre-climbs the first rung of the help ladder. The capstone
      was the worst — it listed all six pipeline stages in order, and that list
      *is* the scaffold sitting one click away. Six prompts had their method or
      their diagnostic moved into the hint where it belongs. Only 2 of 38 prompts
      name an operator from their solution, and both are specs (`pipeline-lookup`
      must say which `$lookup` form is wanted), so no change there.
      Guards added: `test/curriculum.mjs` fails if any prompt, hint or title
      points at the private notes — which immediately found a fourth in a hint my
      own audit had missed, because it only scanned prompts. `test/browser-grade.mjs`
      fails if a drill returns multiple rows in a graded order without saying
      which order.
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
      Vocabulary normalised 2026-09-27 into `content/topics.js`, a closed list
      shared with lesson frontmatter — see the §2 item for what the measurements
      found. Not yet wired to a filter UI; that is the remaining half.
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
- [x] **The differentiator: a live editor on the lesson page itself.** DONE
      2026-09-26. Page-one results for `$lookup`/`$unwind` are Medium posts,
      YouTube and vendor blogs, and *none of them let you run the query*. Every
      example on every lesson now has Run / Edit / Copy, against the same engine
      and the same dataset as the drills.
      - The rule for what counts as runnable is in `engine/runnable.js`: the block
        has to open with `db.<collection>.` naming a collection that exists. A
        Shiki transformer marks those, `src/scripts/runnable.js` enhances them.
      - One dataset per page, shared by every block, so a `$set` in one example
        is visible in the next - with an offer to restore it.
      - `test/examples.mjs` runs all 73 and fails on any that throws *or that
        returns nothing*. The second half is the valuable one: it found six
        lessons querying `users` by `_id: 1` in a collection whose ids start at
        101, plus a `$all` on two skills that never co-occur. Those had been
        wrong since the notes were written and nothing could have noticed.
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
- [x] Core Web Vitals — reading pages ship **1.7 KB** of JavaScript gzipped
      (was zero before the runnable examples). The engine is 36 KB gzipped and
      loads on the first Run, not on page load; the 18 pages with no runnable
      example still ship nothing at all.
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

- [x] `LICENSE` — MIT, 2026-09-27. The repo is now legally open source; before
      this, "open source" in the README was a claim with nothing behind it.
- [x] **`CONTRIBUTING.md`** — done 2026-09-27, and writing it was worth more than
      the page itself. Every instruction on it was tested by following it, which
      turned up three things the guide would otherwise have walked people into:
      - **Two tests made "add an exercise" a failing change.** `test/curriculum.mjs`
        asserted every exercise is reachable from an old `b1-NN` id — true of the
        38 that existed at the rename, false of every one added since. And
        `test/dom-smoke.mjs` hardcoded `38` in three assertions. So the single
        most-wanted contribution broke the suite, in the repo whose §3 plan is to
        grow past 38. Both now derive from the data; the legacy-id check kept the
        half that matters (the map must not *shrink*, or early users lose
        progress).
      - **A drill whose solution returns nothing used to pass.** Grading compares
        the learner's result against the reference solution's, so `[]` equals `[]`
        — and any wrong answer that also finds nothing passes too. The learner
        types the right query, sees no output, and cannot tell. `test/examples.mjs`
        had checked this for *lesson* examples since the runnable-examples work;
        nothing checked it for drills. The rule now lives in
        `test/result-value.mjs` and both suites import it, so they cannot drift.
      - The documented example itself was wrong three ways — it filtered on an
        `orders.total` field that does not exist, tagged `$gte` while using `$gt`,
        and `$gt` was not in the vocabulary. A guide written without running it
        would have shipped all three.
- [~] Rewrite `README.md` for a public audience. The **false** half is fixed
      2026-09-27: it documented `npm start`, which does not exist, and a local
      `mongod` requirement the site dropped when queries moved to the browser —
      so the first thing a contributor tried would fail. Still to do is the
      *public* half: screenshot or GIF first, then what it is, then local dev.
      That needs a screenshot worth showing, which needs the landing page (§5).
- [x] **"Not affiliated with MongoDB, Inc."** disclaimer. It was already in the
      reading-page footer — and `/practice/` is a fixed app shell with no footer,
      so it was the one page of 74 without it, and the page people spend longest
      on and are likeliest to screenshot. `test/links.mjs` now fails if any built
      page lacks the line. (Still don't use their leaf logo or green.)
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
- [ ] Test on a real phone — `npm run test:mobile` proves nothing overflows at
      360px, which is not the same as proving it feels right to use
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
