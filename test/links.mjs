// Crawls the built site and checks that every internal link lands somewhere.
//
// This is the failure the last two steps made possible: 74 pages cross-linking
// by slug, where one renamed lesson produces a 404 that nothing else notices.
// Runs against `dist/`, so it also proves the pages actually built.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPaths } from '../content/curriculum.js';

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

console.log(failed ? `\n  \x1b[31m${failed} link check(s) failed\x1b[0m\n` : `\n  ${green('links OK')}\n`);
process.exit(failed ? 1 : 0);
