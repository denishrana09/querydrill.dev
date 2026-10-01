# Roadmap

The single source of truth for turning this from a localhost practice tool into a
public, hosted, open-source MongoDB learning site. Update it as things land.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[>]` deliberately deferred

---

## Start here

**Done so far:** a layout that works on a phone, checked in a real browser (§2).
Runnable examples on every lesson and topic page - 80 of them, Run/Edit/Copy
against the real engine (§4). Light + dark themes with a toggle, contrast-tested
(§2). The app runs entirely in the browser (§1). 38 drills audited so starters
show structure, never answer (§3). Content restructured into 3 tracks → 12
modules → 54 lessons (§3). 81 static pages with full SEO plumbing, sitemap,
JSON-LD and internal linking (§4). The tag vocabulary normalised into one closed
list, 43 tags down to 7 that earn a clickable chip (§2). The drill list filters by
topic (§2). Prompts audited and made safe for someone who has never seen the
source notes (§3). MIT licensed, with a CONTRIBUTING guide whose every instruction was
tested by following it (§7).
A real code editor in the app and on every lesson page, colours taken from the
existing token set, and none of its 167 KB anywhere near first paint (§2).
Seven topic hub pages for the tags that cross a module, each with its own prose
and a runnable example (§4). 69 "what usually goes wrong" notes, one to three per
drill, shown after a failed attempt and nowhere else (§3). An editor that
completes `$` operators and the fields of the collection the query names (§2).
Graded feedback grouped so one mistake is one line, six lines instead of ten (§3).
A landing page that runs a real query and shows the real grader's real answer to
a real wrong one (§5). A first visit that lands in a drill instead of on a menu,
with the dataset explained in the pane that used to be empty (§6).
`npm run verify` builds and runs twelve suites over all of it.

**Next, in the order I would do it — nothing here is blocked, pick up at the top:**

1. **No launch blockers are left.** The site is live as **QueryDrill at
   querydrill.dev**, on Cloudflare Workers static assets (`wrangler.toml`),
   with its own favicon and share image (`design/`). What remains in §8 is
   dashboard work — Search Console, the `www` redirect — and posting it.
2. **`.gitattributes` with `* text=auto`** (§7) — the repo has mixed line
   endings, which makes one-line edits produce whole-file diffs.
3. Then the remaining §2/§3 polish: the caret in a starter's empty slot, a
   results table view, the cheatsheet page.

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
| Name is **QueryDrill**, domain **querydrill.dev**, repo `querydrill.dev` | "Drill" is what the product already does; MongoDB-only on purpose — another database would be a new project, not a generalisation of this one |
| Hosted on **Cloudflare** (Workers static assets) | Free, no bandwidth cap, so a traffic spike can neither throttle nor bill |

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
- [x] Bundle-size check, and it is now **enforced** rather than measured once.
      `test/links.mjs` walks each built page's static import graph and gzips it:
      **57 KB on `/practice/`** and **2.5 KB on a lesson page**, against written-out
      budgets of 70 KB and 3.5 KB. Everything heavy is behind a dynamic import and
      therefore outside those numbers — mingo 36 KB on the first Run, CodeMirror
      167 KB on the editor upgrade, Prettier 168 KB on the first Format — and the
      check fails if any of them ever becomes eager. The budgets are written in the
      test rather than derived from the build, because a check that measures the
      bundle and compares it to the bundle passes at any size.

---

## 2. UI / UX

- [x] **CodeMirror 6** replacing the `<textarea>`. DONE 2026-09-27. Syntax
      highlighting, matched brackets, auto-close, auto-indent, real undo, and the
      same editor on the lesson pages' Edit button.
      - **The textarea is still in the markup, and is still the editor** until the
        CodeMirror chunk lands. Not politeness about old browsers: it keeps the
        one thing this editor already did well, which is that it is simply there,
        and a failed chunk load now leaves a working editor instead of a dead box.
        `src/scripts/editor.js` is the whole seam - `value`, `insert`, `focus`,
        `refresh`, `el` - and neither caller can tell which host it has.
      - **The syntax colours are the `--syn-*` tokens the results pane already
        uses**, so both themes worked with no new code and `test/contrast.mjs` had
        been checking those five values for weeks. Zero new colour decisions. A
        string you type is the same orange as the string that comes back, and
        `$group` the key sits a colour apart from `"$items.product"` the string -
        which is the confusion people actually have.
      - **Cost, measured rather than guessed.** CodeMirror is 167 KB gzipped, four
        times the rest of the app, so none of it is allowed near first paint: the
        practice page loads 57 KB on arrival and upgrades after, and a lesson page
        loads 2.5 KB and downloads nothing until Edit is pressed. Importing the
        facade at the top of the island instead of inside its click handler
        measured 2.5 KB -> 4.2 KB on all 58 reading pages, for a click most visits
        never make; it is a dynamic import for that reason.
      - `test/links.mjs` now holds a **gzipped budget over each page's static
        import graph**, because that is the only thing standing between one
        misplaced top-level `import` and 167 KB on every lesson page. An earlier
        version of the same guard counted script *requests* and passed when Vite
        inlined the chunk - counting requests does not measure bytes.
      - **`test/editor.mjs` is a real browser, and had to be.** jsdom measures
        everything as zero, so the editor declines to mount CodeMirror there and
        `test/dom-smoke.mjs` drives the fallback - which means "the editor
        silently never upgrades" would have passed every existing suite. 27 checks,
        all asked through the keyboard because auto-close and auto-indent only
        exist in response to real input events. Ten deliberate breaks, each caught
        by the check meant to catch it.
      - Two bugs the tests found rather than confirmed: **one Ctrl+Z after Format
        threw away the query too**, because CodeMirror had merged the rewrite into
        the typing before it (fixed with `isolateHistory`); and a check of mine
        claimed to prove auto-closing brackets while only proving nothing doubled.
        Removing `closeBrackets` left it passing, so the comment was corrected to
        say which check is load-bearing.
      - Tab still indents, as the textarea did - which makes the editor a focus
        trap, the documented cost of that binding. **Escape now leaves the
        editor**, and a test holds it.
      - Deliberately not included: line numbers and an active-line highlight. The
        queries are five lines and the editor pane is 368px wide in the
        three-column layout; a gutter would spend a tenth of it counting to five.
- [x] **Autocomplete for `$` operators.** DONE 2026-09-27. Typing `$` offers the
      operator, what kind of operator it is, and a one-line meaning.
      - **`content/topics.js` was the wrong list**, despite this entry having
        said it was the right one. It is the *tag* vocabulary: closed, narrow,
        and about what the course teaches. It has `$gte` and no `$gt`, because no
        lesson is about `$gt`. Completing from it would have told a learner that
        `$gt`, `$ne`, `$exists` and `$regex` do not exist.
      - So `content/operators.js` is a curated list of 90, and `test/operators.mjs`
        holds it to two rules: every entry is one **mingo actually implements**,
        read out of the engine's own registries rather than listed again; and
        every operator the course teaches is in it. The first stops the editor
        ever suggesting something that errors on Run.
      - Suppressed inside strings, because `"$items.price"` is a field path and
        not an operator. That is the one place a wrong suggestion would appear on
        every single query.
      - **It broke Escape, and the keyboard-trap check caught it.** CodeMirror
        reports a completion as "active" long after the popup has gone, and its
        own Escape binding consumes the key on exactly that condition — so once
        anyone had typed a `$`, leaving the editor took two presses, with nothing
        on screen to explain why. The binding now asks `currentCompletions`,
        which is about the popup rather than the source.
      - **And a bundle check that could not fail.** Adding an `operators.` prefix
        to the lazy-chunk guard looked right and proved nothing: a static import
        is *inlined* into the entry chunk, so the name disappears and the check
        keeps passing while 3 KB lands on every visitor. It searches the bytes
        for a sentence now, and has a companion check that the search works.
        Second time this shape of mistake has been made here — see the editor
        entry below.
      - **The help panel shipped invisible for an hour.** `overflow: hidden` on
        the popup, for the rounded corners; the panel is a *child* of the popup
        that sits outside it. Present in the DOM, right size, never painted. No
        assertion noticed — a screenshot did. There is now a hit test.
- [x] **Autocomplete for field paths.** DONE 2026-09-27. The other half of the
      `$`. Typing a key, or a `$` inside a string, offers the fields of the
      collection the query names - with the type, and how much of the collection
      actually has it.
      - **No list anywhere.** The fields are read from the data with the same
        `inferSchema` the sidebar and the dataset page use, so adding a field to
        the seed makes it completable and there is nothing to keep in sync.
        `editor.js` still has no idea what a dataset is: the caller passes a
        `fields(collection)` function, which matters because that module loads
        on all 58 reading pages.
      - **Which collection comes from the query text** - the last `db.<name>.`
        before the cursor. One check is worth more than the rest put together:
        `db.users.find({ sk` offers `skills` and `db.orders.find({ sk` offers
        nothing, which cannot pass unless the name is really being read.
      - **The presence percentage is the part worth having.** `discount` is on
        57% of orders on purpose, and the completion says so while the field is
        being typed - the earliest possible moment, instead of two drills later
        when `$ifNull` is suddenly the answer.
      - **An unclosed `{` is a different parse.** With the brace closed the
        parser calls a key `PropertyDefinition`; with it missing it guesses
        destructuring and calls the same position `PropertyName`. Auto-closing
        brackets hide that almost always, so it took a *pasted* query to find -
        and the parent node had to be checked too, because `db.orders.fi` is a
        `PropertyName` as well and completing field names there is nonsense.
      - **A check that passed for the wrong reason, again.** "A plain value
        string offers nothing" typed `com` into a status filter - and no field
        starts with those letters, so the popup stayed shut whether the rule
        worked or not. The break sailed through. It types `sta` now, which
        `status` really does prefix. Same shape as the bundle guard that could
        not fail: a check has to be able to *see* the thing it forbids.
- [ ] Put the caret in a starter's **empty slot** rather than at the end of it.
      Neither end of a blank `aggregate([ … ])` is where you want to type, and
      that was true of the textarea too — so it is one fix for both hosts, not a
      CodeMirror detail.
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
      Topic *pages* for those seven tags landed 2026-09-27 — see §4.
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
      found. Now carries three jobs: the drill filter row, the chip rows on
      lessons and cards, and which seven tags get a hub page (§4).
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
- [x] **"Common mistakes" note per exercise, shown after a failed attempt.**
      DONE 2026-09-27. A `mistakes` array on the drill, 1-3 entries, rendered
      under the diff and cleared by a pass. 69 notes across all 38 drills.
      - **The timing is the feature.** Seven hints were already carrying this
        content in their tail - "summing price alone is the classic slip",
        "the naive version returns 20 users, the correct one 10" - told to
        someone who had not yet tried summing anything. Those tails moved here
        and the hints went back to pointing at the mechanism.
      - So it is deliberately **not** a step on the help ladder. A note is free
        to say what the wrong answer is and what its output looks like precisely
        because it cannot be read before failing.
      - Required for `medium` and `hard`, optional for `easy`, enforced at import.
        What makes a drill medium or hard is almost always a way of being wrong
        that does not throw, and naming it is the whole point.
      - A test fails if two drills share a note: a line generic enough to paste
        twice is the padding failure mode for this field, and every per-drill
        rule would pass it.
      - **Known gap:** a learner who passes first time never sees them. The notes
        are some of the best writing on the site and 38 drills' worth of it is
        reachable only by getting something wrong. The per-exercise pages under
        §4 would be the place to surface them properly; a "show them anyway"
        button on a passed card would be the cheap version, and would also undo
        the timing this item exists for.
- [x] **Cap the diff when the shape is wrong.** DONE 2026-09-27. Feedback now
      groups before it prints: one mistake is one line, however many rows or
      fields it lands on. The rules and their reasons are written up in
      ARCHITECTURE.md § "What the feedback is allowed to say".
      - **It was worse than the item said.** Measured rather than assumed: **20
        of the 38 drills** answered their own starter with ten lines, not one,
        and the whole of `find-with-projection` was nine repetitions of "this row
        is not in the answer". The worst case is now six lines; the median is two.
        `revenue-per-product`, the case this item was written about, went from ten
        lines to two.
      - **This item's premise about the two engines was wrong.**
        `server/grade.js` does not hold a copy of the rule - it re-exports
        `engine/compare.js`. There was nothing to keep in sync and no need for
        the conformance suite, which compares *results* between engines, not the
        text of a diff. Noted here because the same wrong assumption would cost
        an afternoon next time.
      - **`compare()` had no tests of its own.** 194 lines deciding whether an
        answer is right, exercised only through "every solution passes" and "one
        obviously wrong answer fails". Everything interesting - what a *nearly*
        right answer is told - was unwatched. `test/compare.mjs` is that suite,
        written before the change so the old behaviour could be seen failing it,
        and 13 of its checks were red on the first run.
      - **The real risk was over-collapsing**, not under-collapsing: a rule that
        groups aggressively enough to fix this can eat the one precise line that
        explains a near-miss. Four checks exist only to hold that line, and one
        of the ten deliberate breaks was aimed at it - which is how it came out
        that the pair-by-`_id` path never consulted the new rule at all, so the
        guard was watching a branch the break did not touch.
      - Two things fixed on the way past, both visible only because the output
        was read as a learner would read it: `{"__date": ...}` - the internal
        wrapper that makes a Date comparable - was appearing in feedback as
        though it were a field of theirs, and "5 more differences not shown" was
        a bullet in the same monospace as the real differences, reading as one
        more of them. It is a caption now, and `compare()` returns the count as
        `hidden` rather than smuggling a sentence into the list.
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
      Plus 12 module hubs, 7 topic hubs and 4 reference pages. 81 pages total.
- [>] One URL per exercise. Deferred, not skipped: drills are deep-linked as
      `/practice/#<slug>` today, which is one page, not 38. A real per-exercise
      page is worth doing once there is a reason for it to rank on its own.
- [x] **Topic hub pages** — `/topics/<tag>/`, one for each of the 7 tags that
      earned a filter chip. DONE 2026-09-27. These are the long-tail operator
      keywords: "mongodb $unwind example", "mongodb $lookup tutorial", "mongodb
      query array of objects".
      - **Measured before building.** All seven cross a module boundary, so none
        of them duplicates a module page — that is the same rule that promoted
        them to filter chips, and it turns out to be exactly the rule for "does
        this deserve a page of its own". A module page is a step in the course;
        a topic page is everything on the site about one idea.
      - **The lessons had to be retagged first, and that exposed a real bug.**
        Lesson frontmatter had a field called `operators`, so lessons only ever
        declared operators — `find`, `arrays` and `update` were on **zero** of
        54 lessons despite a dozen teaching each. The name had quietly become
        the schema. Renamed to `topics`, and 28 lessons gained the concept tags
        they always taught. That field is the JSON-LD `teaches` property, so
        until now the site told Google those lessons taught no concepts at all.
      - **Only the prose is written; every list is derived** from the tag. Adding
        a `$lookup` lesson adds it to `/topics/lookup/` with nothing to remember.
        Related topics come from co-occurrence — two topics are related when the
        same drill carries both — rather than from a hand-written list.
      - Each page carries **its own framing and a runnable example**, which is
        the whole claim over the Medium posts on the same keywords. A hub that
        is only a list of links is a doorway page, and `test/examples.mjs` fails
        if one appears.
      - `/practice/?topic=$lookup` opens the drill list already narrowed, so the
        "Practise $lookup" button lands somewhere that makes sense. Not the same
        as remembering a filter between visits, which stays rejected.
      - Internal linking both ways: the chip row on a lesson page links to the
        hub for the 7 tags that have one and stays a plain label for the other
        49, and `/learn/` grew a "By topic" section.
      - 12 new checks across 4 suites, 7 deliberate breaks, all caught.
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
- [x] Core Web Vitals — reading pages ship **2.5 KB** of JavaScript gzipped: the
      island at 1.8 KB plus Vite's 0.7 KB preload helper, which the older "1.7 KB"
      figure here quietly left out. Was zero before the runnable examples. The
      engine is 36 KB and loads on the first Run; the editor is 169 KB and loads
      on the first Edit; the 18 pages with no runnable example still ship nothing
      at all. `test/links.mjs` now enforces a budget so this stays true.
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

- [x] **Landing page, with a working editor on it.** DONE 2026-09-27. The hero
      is a live query - the same Run/Edit island the lesson pages use, so it
      costs the same 2.6 KB and nothing heavy until someone acts.
      - **Both claims on the page are produced by the thing they claim about, at
        build time.** The example is executed by the real engine and the
        feedback under "wrong answers get a reason" is the real grader's real
        answer to a real wrong query. If the example stops returning rows, or
        that answer stops being wrong, or the drill is renamed, **the build
        fails** rather than shipping a page that lies. All three watched.
      - It is the one runnable block on the site that is not markdown, so
        `test/links.mjs` counts it explicitly rather than being given slack, and
        `test/editor.mjs` presses Run on it in a real browser - the island reads
        a block with `textContent`, and nothing else tested that against markup
        written by hand.
      - **The dataset's size was stated in five places and checked in none.**
        Found while writing two more of them. `test/curriculum.mjs` now holds
        "N users / N orders / N products" to the seed, the same way it already
        held lesson and drill counts - and each count pattern must now match
        something, because the one that could never fire stayed green for weeks.
- [x] **A comparison section** - factual, no names. Four rows, each about a
      practice rather than a product, and each cell true of this site. At phone
      width the table stacks, so the two columns carry their own labels: without
      them a stacked row is two unlabelled sentences about the same thing, which
      is worse than no table.
- [x] **"How it works"** - browser execution, the fixed seed, and open source,
      in three cards under the comparison.
- [x] Visible **"Coming soon"** strip: connect your own MongoDB, `explain()`,
      index tuning — via local mode

---

## 6. Onboarding / how to use

- [x] **First-visit guided path.** DONE 2026-09-27. A first visit opens the first
      drill and fills the field list with the collection that drill queries, so
      the editor holds a starter, the sidebar lists real fields, and the prompt
      says what to do. What it replaced: three empty panes and 38 cards, which is
      a menu asking a stranger to choose before they know what any of it is.
      - **Only when there is nothing to preserve** - any progress, any saved
        draft or any hash and the person's own state wins. That branch is the
        one that can do harm, so it has its own test: a second jsdom and a
        second copy of the module, seeded with progress, asserting that nothing
        opens and the editor is left alone.
      - Which drill is not hardcoded, and the collection is read off the drill's
        own starter rather than declared a second time.
- [x] **The dataset, explained up front.** The empty results pane says what the
      data is, that queries run in the tab, that nothing is uploaded and that
      writes only affect your copy - in the markup, so it is there at first
      paint, and removed by the first run. An empty state rather than a
      dismissible banner: nothing to remember, nothing to store, nothing to
      close.
- [x] **Obvious that data is in-browser, resettable and never uploaded** - said
      in that note, alongside the header pill and the restore bar that already
      appear.
- [x] Hints are already per-exercise, and already progressive: **one escalating
      button** - Hint, then the scaffold if the drill has one, then the solution.
      Three buttons let someone skip straight to the answer and crowded the card.
- [x] **"Show solution" is behind an attempt.** Any attempt - a wrong one is the
      point. Before that the rung explains itself rather than sitting disabled,
      and stays available, because a button that says no without saying how to
      get past it is worse than the thing it is guarding.
- [x] **The editor suggests something runnable** rather than sitting blank: on a
      first visit it holds the opened drill's starter. Cleared later, the
      placeholder still shows a complete query to type.

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
- [x] **Rewrite `README.md` for a public audience.** DONE 2026-09-27. The
      **false** half went first: it documented `npm start`, which does not exist,
      and a local `mongod` requirement the site dropped when queries moved to the
      browser — so the first thing a contributor tried would fail.
      - The *public* half was waiting on "a screenshot worth showing, which needs
        the landing page (§5)". That turned out to be wrong: the app itself was
        the shot, once it had a real editor. Three now, in `docs/` — the app, a
        graded near-miss, and a lesson example being run in place.
      - **Everything in them is real.** The ticks were earned by submitting those
        drills' solutions through the Check button, and the graded shot is an
        actual near-miss (unit price summed without its quantity) with the drill's
        own note underneath. Nothing was staged by hand.
      - **The script is committed now** — `npm run shots`, 2026-09-27. It was a
        throwaway, which made "we changed the logo, retake the shots" a rewrite
        every time. It builds, drives a browser, earns the ticks and grades the
        near-miss, and **fails instead of writing a file** if any of that stops
        working — so a stale or dishonest screenshot is not something the repo
        can quietly acquire. First use was the same day: capping the diff changed
        the graded shot, and regenerating all three was one command.
      - **Found while writing it: six files hardcode how much is on the site** —
        the README three times, the package description, two page titles — and
        nothing checked any of them. §3 is a plan to grow past 38 exercises, so
        all of it was scheduled to become a lie in the copy Google shows.
        `test/curriculum.mjs` now names the file and the phrase for every stale
        number, which is exactly what someone adding a drill needs to be told.
- [x] **"Not affiliated with MongoDB, Inc."** disclaimer. It was already in the
      reading-page footer — and `/practice/` is a fixed app shell with no footer,
      so it was the one page of 74 without it, and the page people spend longest
      on and are likeliest to screenshot. `test/links.mjs` now fails if any built
      page lacks the line. (Still don't use their leaf logo or green.)
- [ ] **`.gitattributes` with `* text=auto`.** The repo has mixed line endings —
      `src/scripts/app.js` and `package-lock.json` are CRLF, everything around
      them is LF — so a tool that rewrites a file flips its endings and the diff
      becomes every line. `npm install` did exactly that to the lockfile and
      buried 155 real lines in a 10,000-line change. Harmless today because one
      person on one machine notices and puts it back; the first Linux contributor
      makes it everyone's problem. Worth doing as its own commit, since
      normalising will touch both files on its own.
- [ ] Issue templates: bug, new exercise, wrong grading
- [ ] `good first issue` labels — exercise contributions are ideal for this
- [ ] CI badge + conformance badge
- [x] Rename repo on GitHub once the name is chosen — now `querydrill.dev`
- [ ] Flip the repo public

---

## 8. Launch

### Blockers — things that are actively wrong until fixed

Audited 2026-09-26. These are not polish. Each one is currently shipped-broken
in `dist/`, and the first is the kind of mistake that costs the whole SEO effort.

- [x] **`site: 'https://example.com'` in `astro.config.mjs` poisons every page.**
      DONE 2026-10-01: now `https://querydrill.dev`.
      All 74 pages emit `<link rel="canonical" href="https://example.com/...">`,
      and the sitemap and every OG URL do the same. A canonical tells Google
      "this is the real address of this page", so right now all 74 declare a
      domain we do not own as authoritative. Changing the one line fixes all of
      them at once — but nothing can be deployed before it is changed, and a
      deploy that happens to go out first is worse than not deploying.
- [x] **A real 1200×630 share image.** DONE 2026-10-01: `public/og.png`,
      rendered from `design/og.html` by `design/render.mjs`, which also makes
      `favicon.ico` and `apple-touch-icon.png` from `favicon.svg`. The favicon
      itself was redrawn — the old one was MongoDB's leaf, which is their
      trademark and reads as an endorsement on a site with its own name.
      **The bug the missing image caused was fixed earlier** (2026-09-27): `Base.astro` no longer names
      `/og-default.png`, because a card pointing at a missing image is worse
      than a card with none — the platform fetches it, gets a 404, and shows a
      broken preview instead of falling back to the title and description.
      `twitter:card` drops to `summary` for the same reason. Turning both back
      on is one constant in `Base.astro` once the image exists.
- [x] **A 404 page.** DONE 2026-09-27. `src/pages/404.astro` builds to
      `dist/404.html`. Cloudflare Pages served it with no configuration; a
      Worker does not — it needs `not_found_handling = "404-page"` in
      `wrangler.toml`, and served a blank 404 until that went in (2026-10-01). `noindex`, kept out of `allPaths()` so it never
      reaches the sitemap, and its only job is to be a way back in: the course,
      the app, the dataset and the reference pages, all listed from the
      curriculum rather than written out.
- [x] **Sitemap `<lastmod>`.** DONE 2026-09-27, read out of git — one
      `git log --name-only` pass mapped to each page's own content file.
      - **Not the mtime and not the build clock.** A fresh clone sets every
        mtime to now, so a CI build would publish 81 pages all claiming to have
        changed today, every day. That is worse than saying nothing: the field
        is only worth reading if it is sometimes old. The check that matters is
        therefore not "is there a lastmod" but **"are they all the same day"**,
        which is what a build-clock wiring looks like and what it now fails on.
      - It points at the *content* file, not the template. Restyling a layout
        does not mean 54 lessons changed.
      - No git, a tarball, a shallow clone: the date is omitted rather than
        guessed, which is the honest answer to "when did this change" when the
        answer is not known.
      - **The shallow case was wrong until 2026-10-01, and the first deploy
        shipped it**: git does not fail in a shallow clone, it reports every
        file as added by the one commit it has, so all 81 pages said "today".
        Cloudflare's build clones shallow, so this is the deploy's normal
        case. Now detected and omitted. Getting real dates back in production
        needs the build to fetch full history first.
      - Dates are UTC. Sliced from the committer's local time, a commit at
        01:00 IST was dated a day ahead and failed the "not in the future"
        check.
- [x] **Every referenced local asset must exist** — `test/links.mjs`,
      2026-09-27. The reason nothing noticed `og-default.png` for weeks is now
      the best part of the story: the link scan **skipped it by name**. The
      exclusion `/^(https?:|mailto:|#|\/favicon|\/og-)/` was added while the
      file was missing, which is exactly the wrong way round. It is gone, and
      the new check covers `src`, stylesheet and icon `href`s, and the
      `og:image`/`twitter:image` paths — with a companion check that the scan
      finds anything at all, since a scan that matches nothing reports no
      missing assets just as cheerfully as a clean build does.
- [>] Decide whether `example.com` should instead fail the build. Moot now
      that the real domain is in; it only mattered while a placeholder could ship.

### The rest

- [x] Buy the domain — `querydrill.dev` at Porkbun, 2026-10-01
- [x] Point the domain at Cloudflare (nameservers) and attach it to the Worker
- [x] Deploy — Cloudflare Workers static assets, `wrangler.toml` serves `dist/`.
      Live at https://querydrill.dev since 2026-10-01
- [ ] `www.querydrill.dev` and `*.querydrill.dev` still point at Porkbun's
      parking page (records imported with the zone) — redirect `www` to the apex
- [ ] Google Search Console + Bing Webmaster Tools: verify the domain, submit
      `sitemap.xml`
- [ ] Real `<lastmod>` dates in production: the build needs full git history
      (`git fetch --unshallow` before `npm run build` in the Cloudflare build
      command); until then the sitemap ships without dates
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

- [x] Final name + domain — QueryDrill, querydrill.dev (§0)
- [x] Host — Cloudflare (§0)
- [ ] Whether to keep the `notes` dataset at all, or fold its examples into lessons
