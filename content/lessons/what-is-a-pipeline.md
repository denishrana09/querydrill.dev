---
title: 'What a pipeline actually is'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'A MongoDB aggregation pipeline is an ordered list of stages, each transforming the documents the previous stage produced.'
source: 'batch2.md:116-149'
---

A pipeline is a list of stages, and each stage receives whatever the previous stage emitted. Nothing more mysterious than that - but the "whatever the previous stage emitted" part is where every aggregation bug lives.

```js
db.orders.aggregate([
  { /* stage 1 */ },
  { /* stage 2 */ },
  { /* stage 3 */ }
])
```

Think like Node.js:

```js
const result = orders
  .filter(...)
  .map(...)
  .sort(...)
```

Aggregation is conceptually similar:

```text
$match    ≈ filter()
$project  ≈ map()
$sort     ≈ sort()
$group    ≈ groupBy + reduce()
```

That analogy is not perfect, but it is useful.
