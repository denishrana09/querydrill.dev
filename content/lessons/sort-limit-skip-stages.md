---
title: '$sort, $limit, $skip — order matters'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'MongoDB $sort, $limit and $skip as pipeline stages, and why swapping their order changes the answer, not just the speed.'
operators: ['$limit', '$match', '$skip', '$sort']
source: 'batch2.md:434-531'
---

These behave like their `find()` counterparts, with one difference that matters far more in a pipeline: they are stages, so their position changes the result. `$limit` before `$sort` is a different query from `$sort` before `$limit`.

```js
{
  $sort: {
    createdAt: -1
  }
}
```

Multiple fields:

```js
{
  $sort: {
    userId: 1,
    createdAt: -1
  }
}
```

## `$limit` and `$skip`

```js
{
  $limit: 10
}
```

```js
{
  $skip: 20
}
```

Example:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },
  {
    $sort: {
      createdAt: -1
    }
  },
  {
    $skip: 20
  },
  {
    $limit: 10
  }
])
```

## ⚠️ Order Matters

This:

```text
$sort
↓
$limit
```

means:

> Find the top 10 after sorting.

But:

```text
$limit
↓
$sort
```

means:

> Take the first 10 arbitrary/current-order documents, then sort only those 10.

Aggregation is a pipeline.

**Every stage receives the output of the previous stage.**

This sounds obvious, but it is one of the biggest sources of mistakes.
