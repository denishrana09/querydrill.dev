import { defineConfig } from 'astro/config';

// `site` is what makes canonical URLs, OG tags and the sitemap emit absolute
// URLs. It is a placeholder until the domain is bought - see ROADMAP.md.
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },

  vite: {
    optimizeDeps: {
      // Prettier is only ever reached through a dynamic import, so Vite does not
      // discover it while scanning. The first Format click would then trigger a
      // dependency re-optimisation, and the in-flight import fails with
      // "error importing dynamic module" - once, before a reload fixes it.
      // Naming them here gets them pre-bundled up front instead.
      include: [
        'prettier/standalone',
        'prettier/plugins/babel',
        'prettier/plugins/estree',
      ],
    },
  },
});
