// Crawls the built site and checks that every internal link lands somewhere.
//
// This is the failure the last two steps made possible: 74 pages cross-linking
// by slug, where one renamed lesson produces a 404 that nothing else notices.
// Runs against `dist/`, so it also proves the pages actually built.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPaths, TOPIC_PAGES } from '../content/curriculum.js';
import { fencesIn } from '../engine/runnable.js';
import { inferSchema } from '../src/scripts/schema.js';
import ecommerce from '../server/datasets/ecommerce.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const green = (s) => `\x1b[32m${s}\x1b[0m`;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) return console.log(`  ${green('ok')}    ${label}`);
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `\n        ${detail}` : ''}`);
}

if (!existsSync(DIST)) {
  console.log('  \x1b[31mFAIL\x1b[0m  dist/ is missing - run `npm run build` first');
  process.exit(1);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));
check('the site built some pages', htmlFiles.length > 20, `${htmlFiles.length} html files`);

/** "/learn/upsert/" -> dist/learn/upsert/index.html */
const resolves = (href) => {
  const path = href.split('#')[0].split('?')[0];
  if (!path.startsWith('/')) return true; // relative links are not used here
  const base = join(DIST, path);
  return existsSync(base) || existsSync(join(base, 'index.html')) || existsSync(base + '.html');
};

const broken = [];
const hashLinks = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const from = '/' + relative(DIST, file).replace(/\\/g, '/');
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#|\/favicon|\/og-)/.test(href)) continue;
    if (href.includes('#')) hashLinks.push({ from, href });
    if (!resolves(href)) broken.push(`${from} -> ${href}`);
  }
}

check('every internal link resolves', broken.length === 0,
  [...new Set(broken)].slice(0, 12).join('\n        '));

// Deep links into the app carry an exercise id in the hash. A stale one loads
// the page and quietly does nothing, which is worse than a 404.
const { EXERCISES } = await import('../server/exercises/index.js');
const ids = new Set(EXERCISES.map((e) => e.id));
const badHashes = hashLinks
  .filter((l) => l.href.startsWith('/practice/#'))
  .filter((l) => !ids.has(decodeURIComponent(l.href.split('#')[1])));
check('every /practice/#id deep link names a real exercise', badHashes.length === 0,
  badHashes.slice(0, 8).map((l) => `${l.from} -> ${l.href}`).join('\n        '));

// Every drill should be reachable from a lesson or module page, or nothing
// links to it and it may as well not exist.
const linked = new Set(
  hashLinks.filter((l) => l.href.startsWith('/practice/#'))
    .map((l) => decodeURIComponent(l.href.split('#')[1]))
);
check('every exercise is linked from at least one page',
  EXERCISES.every((e) => linked.has(e.id)),
  EXERCISES.filter((e) => !linked.has(e.id)).map((e) => e.id).join(', '));

/* ---------- the curriculum's own promises ---------- */

const missing = allPaths().filter((p) => !resolves(p));
check('every path the sitemap advertises was built', missing.length === 0, missing.join(', '));

const sitemap = join(DIST, 'sitemap.xml');
check('sitemap.xml was written', existsSync(sitemap));
if (existsSync(sitemap)) {
  const xml = readFileSync(sitemap, 'utf8');
  check('sitemap lists every page', allPaths().every((p) => xml.includes(p)),
    allPaths().filter((p) => !xml.includes(p)).join(', '));
}
check('robots.txt was written', existsSync(join(DIST, 'robots.txt')));

/* ---------- head tags ---------- */

const noTitle = htmlFiles.filter((f) => !/<title>[^<]{10,}<\/title>/.test(readFileSync(f, 'utf8')));
check('every page has a real title', noTitle.length === 0,
  noTitle.map((f) => relative(DIST, f)).join(', '));

const noDesc = htmlFiles.filter(
  (f) => !/<meta name="description" content="[^"]{40,}"/.test(readFileSync(f, 'utf8'))
);
check('every page has a description', noDesc.length === 0,
  noDesc.map((f) => relative(DIST, f)).join(', '));

const titles = htmlFiles.map((f) => readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)?.[1]);
const dupeTitles = [...new Set(titles.filter((t, i) => titles.indexOf(t) !== i))];
check('no two pages share a title', dupeTitles.length === 0, dupeTitles.join(' | '));

// The dataset page exists to show which fields are optional, and it was getting
// that exactly wrong: inferSchema reports presence as a ratio (0-1) and the page
// read it as a percentage, so every field tested as "< 100" and the whole table
// rendered optional - 0 fields said "always", 31 said "1%", and the callout
// announced that `discount` is "present on 1% of documents". Checked against the
// real data rather than against a hardcoded string, so it cannot drift.
{
  const html = readFileSync(join(DIST, 'dataset', 'index.html'), 'utf8');
  const built = ecommerce.build();
  // All three collections: the optional fields - the whole reason this page
  // exists - live on `orders`, so checking `users` alone passed while the page
  // was broken. A check that cannot fail is not a check.
  const fields = Object.values(built).flatMap((docs) => inferSchema(docs));
  const always = fields.filter((f) => f.presence === 1).length;
  const partial = fields.filter((f) => f.presence < 1);

  check('the dataset actually has optional fields to report', partial.length > 0,
    'nothing to check - this guard would pass vacuously');

  check('the dataset page marks always-present fields as always',
    always > 0 && html.includes('>always<'),
    `${always} fields are always present; the page says "always" ${(html.match(/>always</g) || []).length} times`);

  const wrong = partial
    .map((f) => ({ f, want: `${Math.round(f.presence * 100)}%` }))
    .filter(({ want }) => !html.includes(`>${want}<`));
  check('and reports each optional field at its real percentage', wrong.length === 0,
    wrong.map(({ f, want }) => `${f.path} should show ${want}`).join(', '));

  check('no field is reported as a bare ratio', !/present on [01]% of documents/.test(html),
    (html.match(/present on [\d.]+% of documents/g) || []).slice(0, 3).join(' | '));
}

// MongoDB Inc. is protective of the mark, so this line is not decoration. It
// lived in the reading-page footer, which meant /practice/ - the app shell, with
// no footer, and the page people spend the longest on - was the one page of 74
// without it. Nothing noticed for weeks.
const noDisclaimer = htmlFiles
  .filter((f) => !readFileSync(f, 'utf8').includes('Not affiliated with MongoDB, Inc.'))
  .map((f) => '/' + relative(DIST, f).replace(/\\/g, '/'));
check('every page carries the trademark disclaimer', noDisclaimer.length === 0,
  noDisclaimer.join(', '));

/* ---------- runnable examples ---------- */

// Astro caches rendered markdown between builds, so a change to the rule in
// engine/runnable.js reaches only the files whose mtime also changed. That looks
// like a clean build and ships 6 marked pages instead of 26. Comparing the built
// HTML against the rule is the only way to notice.
const runnableInContent = [];
for (const dir of ['content/lessons', 'content/reference', 'content/topic-pages']) {
  for (const file of readdirSync(new URL(`../${dir}`, import.meta.url))) {
    const source = readFileSync(new URL(`../${dir}/${file}`, import.meta.url), 'utf8');
    const n = fencesIn(source).filter((f) => f.runnable).length;
    if (n) runnableInContent.push({ slug: file.replace(/\.md$/, ''), n });
  }
}

const expectedBlocks = runnableInContent.reduce((sum, p) => sum + p.n, 0);
const builtBlocks = htmlFiles.reduce(
  (sum, f) => sum + (readFileSync(f, 'utf8').match(/data-runnable/g)?.length ?? 0), 0);
check('the built pages mark exactly the blocks the rule marks',
  builtBlocks === expectedBlocks, `built ${builtBlocks}, rule says ${expectedBlocks}`);

// The island is only any use if its script came along, and the script is only
// worth its bytes on a page that has a block for it.
const withBlocks = htmlFiles.filter((f) => readFileSync(f, 'utf8').includes('data-runnable'));
const withScript = htmlFiles.filter((f) => /RunnableExamples\.astro_astro_type_script/.test(readFileSync(f, 'utf8')));
const noScript = withBlocks.filter((f) => !withScript.includes(f));
const noBlocks = withScript.filter((f) => !withBlocks.includes(f));
check('every page with a runnable block ships the script', noScript.length === 0,
  noScript.map((f) => relative(DIST, f)).join(', '));
check('no page ships the script without a runnable block', noBlocks.length === 0,
  noBlocks.map((f) => relative(DIST, f)).join(', '));

/* ---------- the topic hubs gathered something ---------- */

// Everything on a topic page except its prose is derived from the tag, which
// means the whole page can come out empty from one wrong field name and still
// build, still validate, and still look deliberate. test/topics.mjs proves the
// material exists; this proves it reached the HTML.
{
  const thin = [];
  for (const t of TOPIC_PAGES) {
    const file = join(DIST, 'topics', t.slug, 'index.html');
    if (!existsSync(file)) { thin.push(`/topics/${t.slug}/ was not built`); continue; }
    const html = readFileSync(file, 'utf8');
    const lessons = new Set([...html.matchAll(/href="\/learn\/([^"/]+)\//g)].map((m) => m[1]));
    const drills = new Set([...html.matchAll(/href="\/practice\/#([^"]+)"/g)].map((m) => m[1]));
    const want = EXERCISES.filter((e) => e.topics.includes(t.topic)).length;
    if (!lessons.size) thin.push(`/topics/${t.slug}/ links to no lessons`);
    if (drills.size < want) {
      thin.push(`/topics/${t.slug}/ links to ${drills.size} drills, ${want} carry the tag`);
    }
    if (!html.includes(`/practice/?topic=${encodeURIComponent(t.topic)}`)) {
      thin.push(`/topics/${t.slug}/ has no filtered practice link`);
    }
  }
  check('every topic hub lists the lessons and drills that carry its tag',
    thin.length === 0, thin.join('\n        '));
}

/* ---------- what each page weighs before anyone clicks anything ---------- */

// The reading pages are the SEO strategy, and their whole advantage is that they
// are documents rather than applications. That is a property of the import graph,
// which is invisible in every other check here: one `import` at the top of
// src/scripts/runnable.js instead of inside its Edit handler puts CodeMirror's
// facade on all 58 of them, and a careless one puts CodeMirror itself there -
// 167 KB gzipped, on a page whose reader may never touch an editor.
//
// The budgets below are written out here rather than derived from the build, on
// purpose. A check that measures the bundle and compares it to the bundle passes
// no matter how large the bundle gets.
{
  const BUDGET_READING = 3_500;    // measured 2,589 B: the island + the preload helper
  const BUDGET_APP = 70_000;       // measured 57,116 B: mostly mingo and the dataset

  const gz = (file) => gzipSync(readFileSync(file)).length;

  /** Every chunk a page pulls before any user action - the static import graph. */
  const staticGraph = (html) => {
    const seen = new Set();
    const queue = [...html.matchAll(/<script[^>]*src="(\/_astro\/[^"]+)"/g)].map((m) => m[1].slice(1));
    while (queue.length) {
      const path = queue.shift();
      if (seen.has(path)) continue;
      seen.add(path);
      const full = join(DIST, path);
      if (!existsSync(full)) continue;
      // A dynamic import compiles to `import("./x.js")`; only a bare `from"./x"`
      // is loaded up front, which is exactly the distinction being measured.
      for (const m of readFileSync(full, 'utf8').matchAll(/from\s*"\.\/([^"]+)"/g)) {
        queue.push('_astro/' + m[1]);
      }
    }
    return [...seen];
  };

  const weighed = htmlFiles.map((file) => {
    const chunks = staticGraph(readFileSync(file, 'utf8'));
    return {
      path: '/' + relative(DIST, file).replace(/\\/g, '/'),
      bytes: chunks.reduce((sum, c) => sum + gz(join(DIST, c)), 0),
      chunks,
    };
  });

  const app = weighed.find((p) => p.path === '/practice/index.html');
  const reading = weighed.filter((p) => p !== app);
  const withScripts = reading.filter((p) => p.chunks.length > 0);

  // Without this the budget check below is satisfied by finding nothing at all,
  // which is what a regex that stops matching Astro's output would produce.
  check('the runnable pages were found to weigh anything', withScripts.length > 20,
    `only ${withScripts.length} of ${reading.length} reading pages load any script`);

  const heaviest = withScripts.sort((a, b) => b.bytes - a.bytes)[0];
  check(`no reading page loads more than ${BUDGET_READING} B of JavaScript up front`,
    !heaviest || heaviest.bytes <= BUDGET_READING,
    heaviest && `${heaviest.path} loads ${heaviest.bytes} B: ${heaviest.chunks.join(', ')}`);
  if (heaviest) {
    console.log(`        ${heaviest.bytes} B gzipped on a lesson page, ${app?.bytes ?? '?'} B on /practice/`);
  }

  check('the practice app was found to weigh anything', Boolean(app?.bytes), 'no scripts on /practice/');
  check(`the app loads no more than ${BUDGET_APP} B up front`,
    Boolean(app) && app.bytes <= BUDGET_APP,
    app && `${app.bytes} B: ${app.chunks.join(', ')}`);

  // CodeMirror and Prettier are both larger than everything else put together,
  // and both are only any use once someone acts. Naming them keeps the budget
  // above honest about *why* it is the number it is.
  const lazyOnly = ['dist.', 'babel.', 'estree.', 'standalone.'];
  const eager = [...new Set(weighed.flatMap((p) => p.chunks))]
    .filter((c) => lazyOnly.some((prefix) => c.startsWith('_astro/' + prefix)));
  check('neither CodeMirror nor Prettier is loaded before it is needed',
    eager.length === 0, eager.join(', '));

  // The editor's completion list - 90 operators and a sentence about each - is
  // held out of the first load by one line in src/scripts/editor.js: it is
  // imported inside the dynamic import rather than at the top of the file.
  //
  // Checked by looking for the text, not for a chunk called `operators.*`.
  // Adding that prefix to the list above was the obvious guard and it is a
  // useless one: a static import gets INLINED into the entry chunk, so the name
  // disappears and the check goes on passing while 3 KB lands on every visitor.
  // Watched to fail before being believed, which is the only reason that is
  // known. A string literal survives minification; a module name does not.
  const SENTINEL = 'adds one unit price per line';        // from a mistake note
  const OPERATOR_SENTINEL = 'Folds an array to one value'; // from $reduce's help
  const carrying = (needle) => [...new Set(weighed.flatMap((p) => p.chunks))]
    .filter((c) => existsSync(join(DIST, c)) && readFileSync(join(DIST, c), 'utf8').includes(needle));

  check('the operator help is not in what a page loads up front',
    carrying(OPERATOR_SENTINEL).length === 0, carrying(OPERATOR_SENTINEL).join(', '));
  // The other half of the pair, and the reason to trust the first: the mistake
  // notes ARE statically imported with the exercises, so this must find them.
  // If it does not, the search is broken rather than the bundle being clean.
  check('...and the search would have found it if it were',
    carrying(SENTINEL).length > 0,
    'the sentinel scan found nothing anywhere, so it proves nothing');
}

console.log(failed ? `\n  \x1b[31m${failed} link check(s) failed\x1b[0m\n` : `\n  ${green('links OK')}\n`);
process.exit(failed ? 1 : 0);
