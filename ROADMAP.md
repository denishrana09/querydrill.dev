# Roadmap

The single source of truth for turning this from a localhost practice tool into a
public, hosted, open-source MongoDB learning site. Update it as things land.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[>]` deliberately deferred

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
- [ ] Astro scaffold + repo layout (`engine/` `src/` `server/` `content/`)
- [ ] Port the UI to the browser engine; delete the fetch-based API layer from the client
- [ ] Dataset + exercises importable from the browser bundle
- [ ] GitHub Actions: conformance test against a real `mongo:7` service container
- [ ] Bundle-size check — keep initial JS under ~250KB gzipped

---

## 2. UI / UX

- [ ] **CodeMirror 6** replacing the `<textarea>` — JS syntax highlighting, bracket matching, auto-indent
- [ ] Autocomplete for collection names and `$` operators (big perceived-quality win)
- [ ] **Responsive layout** — the 3-pane grid is unusable on a phone, and Google will send phones
- [ ] Dark mode (site is dark-first; respect `prefers-color-scheme`)
- [ ] Results pane: table view toggle alongside raw JSON
- [ ] Keyboard shortcuts, discoverable (`Ctrl+Enter` run, `Ctrl+/` comment)
- [ ] Loading/empty/error states that don't look broken
- [ ] Schema sidebar: collection → field names + types, expandable, click-to-insert
- [ ] "Reset data" button (browser store is mutable; users will break it and panic)
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

- [ ] Split the batch files into **~30–40 lesson units**, one per concept
- [ ] Each lesson maps 1:1 to its exercise(s); use the existing `noteRef` line anchors
- [ ] Render lessons **in-app** beside the editor, not as separate files
- [ ] Every lesson gets a runnable example, pre-filled into the editor in one click
- [ ] **Rewrite problem descriptions** for a worldwide audience:
      - state the goal, the collection, and the exact expected shape
      - no assumed context from having read the notes end to end
      - say explicitly when order matters vs doesn't
- [ ] Difficulty tags (easy / medium / hard) — honest ones, not everything "easy"
- [ ] Topic tags per exercise (`find`, `$group`, `$lookup`, `update`, …) for filtering
- [ ] A defined **learning track**: ordered path through lessons, not just a flat list
- [ ] Grow past 38 exercises — but **never pad**. One concept = one exercise.
      MongoPractice claims "530 problems" that are `SKU-1021`…`SKU-1025` style
      generated duplicates; not matching that number is a feature, not a gap.
- [ ] "Common mistakes" note per exercise, shown after a failed attempt
- [ ] Cheatsheet page (operator → one-line meaning → link to its lesson)

---

## 4. SEO

The brand name will bring almost nothing. Lesson pages bring the traffic.

- [ ] **One prerendered URL per lesson** (`/learn/lookup-join-collections`) with
      real server-rendered content — not client-rendered
- [ ] One URL per exercise (`/practice/group-revenue-by-category`)
- [ ] Target **long-tail operator keywords**: "mongodb $unwind example",
      "mongodb $lookup tutorial", "mongodb aggregation practice"
- [ ] Do **not** fight head terms — W3Schools/GeeksforGeeks own "mongodb exercises"
- [ ] The differentiator for ranking: page-one results for `$lookup`/`$unwind` are
      Medium posts, YouTube, and vendor blogs — **none of them let you run the query**.
      Every lesson page must have a live editor above the fold.
- [ ] Unique `<title>` + `<meta description>` per page
- [ ] JSON-LD structured data: `LearningResource` / `HowTo` / `FAQPage`
- [ ] `sitemap.xml` + `robots.txt`
- [ ] Canonical URLs
- [ ] OG/Twitter cards per lesson
- [ ] Internal linking: lesson ↔ exercise ↔ related operators
- [ ] Core Web Vitals — Astro ships zero JS on static pages; keep it that way
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
