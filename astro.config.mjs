import { defineConfig } from 'astro/config';

// `site` is what makes canonical URLs, OG tags and the sitemap emit absolute
// URLs. It is a placeholder until the domain is bought - see ROADMAP.md.
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
