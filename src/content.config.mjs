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
    topics: z.array(z.string().refine(isTopic, {
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

// One page per topic that earned a filter chip — see `content/topics.js` for the
// rule, which is that a tag has to cross a module and have three drills behind
// it. These are hub pages: their own framing and a runnable example, then the
// lessons and drills carrying that tag gathered from across the modules that
// hold them. `topic` is the tag slug; the file name is the URL, because a `$` in
// a path is legal and horrible.
const topicPages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/topic-pages' }),
  schema: z.object({
    title: z.string(),
    topic: z.string().refine(isTopic, {
      message: 'not in content/topics.js - a topic page needs a tag that exists',
    }),
    description: z.string().min(40).max(165),
    // Shown under the H1. The prose is the page; this is the one sentence that
    // has to stand on its own above a list of links.
    lede: z.string().min(40),
  }),
});

export const collections = { lessons, reference, topicPages };
