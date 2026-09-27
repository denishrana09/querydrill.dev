import { execFileSync } from 'node:child_process';

import { allPaths, sourceFor } from '../../content/curriculum.js';

/**
 * When each page's content last changed, read out of git.
 *
 * Not the build time, and not the file's mtime: a fresh clone sets every mtime
 * to now, so a CI build would publish a sitemap claiming all 81 pages changed
 * today, every day. That is worse than saying nothing - `<lastmod>` is only
 * worth reading if it is sometimes old, and a feed that is always "now" is one
 * a crawler learns to ignore.
 *
 * One `git log` pass rather than one call per file: the output is a commit date
 * followed by the files that commit touched, so the first time a path appears
 * is its most recent change.
 *
 * @returns {Map<string, string>} repo path -> ISO date, empty if git cannot answer
 */
function lastCommitDates() {
  const dates = new Map();
  let log = '';
  try {
    log = execFileSync('git', ['log', '--name-only', '--format=%cI', '--no-merges'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // No git, a tarball, a shallow clone with no history. Every page then goes
    // out without a <lastmod>, which is the honest answer to "when did this
    // change" when the answer is not known.
    return dates;
  }

  let current = null;
  for (const line of log.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) { current = text; continue; }
    if (current && !dates.has(text)) dates.set(text, current);
  }
  return dates;
}

// Generated from the curriculum rather than by crawling the output, so a page
// that exists but is not reachable from the course never gets listed - if it is
// not in the curriculum, it is not part of the site.
export function GET({ site }) {
  const dates = lastCommitDates();

  const urls = allPaths()
    .map((path) => {
      const loc = new URL(path, site).href;
      // The course pages are the ranking strategy; the app is the destination.
      const priority = path === '/' ? '1.0' : path.startsWith('/learn/') ? '0.8' : '0.6';
      const source = sourceFor(path);
      const changed = source && dates.get(source);
      const lastmod = changed ? `<lastmod>${changed.slice(0, 10)}</lastmod>` : '';
      return `  <url><loc>${loc}</loc>${lastmod}<priority>${priority}</priority></url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
