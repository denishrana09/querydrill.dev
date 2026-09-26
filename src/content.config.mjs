import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { isTopic } from '../content/topics.js';

// Lessons live in `content/`, not `src/content/`, because they are the product
// rather than an implementation detail of the site - the same reason exercises
// live in `server/`. The glob loader reads them from there directly.
//
// The schema is deliberately strict: a lesson without a description is a page
// Google writes the snippet for instead of us, and that is the whole ranking
// strategy. `test/curriculum.mjs` checks the same fields without a build.

const lessons = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/lessons' }),
  schema: z.object({
    title: z.string(),
    module: z.string(),
    track: z.string(),
    description: z.string().min(40).max(165),
    // Checked against the shared vocabulary, because this field is not just a
    // chip row: it becomes the JSON-LD `teaches` property. `$contains` was
    // listed here for months on the arrays lesson, whose own prose says the
    // operator does not exist - so the page told Google it taught something
    // imaginary. A free-form array of strings could not have caught that.
    operators: z.array(z.string().refine(isTopic, {
      message: 'not in content/topics.js - add it there, or fix the spelling',
    })).optional(),
    // Line range in the original notes. Provenance, not a live pointer.
    source: z.string().optional(),
  }),
});

const reference = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/reference' }),
  schema: z.object({
    title: z.string(),
    kind: z.literal('reference'),
    description: z.string().min(40).max(165),
    source: z.string().optional(),
  }),
});

export const collections = { lessons, reference };
