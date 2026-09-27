import { defineConfig } from 'astro/config';
import { isRunnable } from './engine/runnable.js';

// `site` is what makes canonical URLs, OG tags and the sitemap emit absolute
// URLs. It is a placeholder until the domain is bought - see ROADMAP.md.
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  build: { format: 'directory' },
  devToolbar: { enabled: false },

  markdown: {
    shikiConfig: {
      // Both themes are emitted at once: the light colours become inline
      // styles and the dark ones become `--shiki-dark-*` custom properties on
      // the same spans, which doc.css swaps in. A single pinned theme would
      // leave every code block on all 58 content pages dark-on-light.
      themes: { light: 'github-light', dark: 'github-dark' },
      transformers: [
        {
          // Shiki writes its theme's background as an inline style, which beats
          // any stylesheet and leaves every code block a slightly different
          // grey from the panels around it. Dropping it lets doc.css decide.
          pre(node) {
            node.properties.style = String(node.properties.style ?? '')
              .replace(/background-color:[^;]*;?/, '')
              .trim();

            // Marks the blocks that src/scripts/runnable.js turns into a Run
            // button. Decided here because this is the one place that sees the
            // raw source, the language and the fence's info string at once.
            if (isRunnable(this.source, this.options.lang, this.options.meta?.__raw)) {
              node.properties['data-runnable'] = '';
            }
          },
        },
      ],
    },
  },

  vite: {
    optimizeDeps: {
      // Prettier is only ever reached through a dynamic import, so Vite does not
      // discover it while scanning. The first Format click would then trigger a
      // dependency re-optimisation, and the in-flight import fails with
      // "error importing dynamic module" - once, before a reload fixes it.
      // Naming them here gets them pre-bundled up front instead. CodeMirror is
      // on the list for the same reason: it is only ever reached through the
      // dynamic import in src/scripts/editor.js, so in dev the first page load
      // would re-optimise and the in-flight import would fail - once, silently
      // falling back to the textarea, which is the hardest version of this bug
      // to notice.
      include: [
        'prettier/standalone',
        'prettier/plugins/babel',
        'prettier/plugins/estree',
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/language',
        '@codemirror/commands',
        '@codemirror/autocomplete',
        '@codemirror/lang-javascript',
        '@lezer/highlight',
      ],
    },
  },
});
