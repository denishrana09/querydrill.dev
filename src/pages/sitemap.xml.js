import { allPaths } from '../../content/curriculum.js';

// Generated from the curriculum rather than by crawling the output, so a page
// that exists but is not reachable from the course never gets listed - if it is
// not in the curriculum, it is not part of the site.
export function GET({ site }) {
  const urls = allPaths()
    .map((path) => {
      const loc = new URL(path, site).href;
      // The course pages are the ranking strategy; the app is the destination.
      const priority = path === '/' ? '1.0' : path.startsWith('/learn/') ? '0.8' : '0.6';
      return `  <url><loc>${loc}</loc><priority>${priority}</priority></url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
}
