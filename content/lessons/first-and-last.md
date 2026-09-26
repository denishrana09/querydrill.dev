---
title: '$first and $last'
module: 'grouping'
track: 'aggregation'
description: 'MongoDB $first and $last pick a value from each group, and both depend entirely on the $sort you ran beforehand.'
operators: ['$first', '$group', '$last', '$sort']
source: 'batch2.md:1274-1319'
---

`$first` and `$last` take a value from the start or end of each group. Neither has any idea what "first" means on its own - they read whatever order the documents arrived in, which makes the `$sort` before them part of the answer, not a formatting step.

Suppose:

```js
{
  $sort: {
    createdAt: -1
  }
}
```

Then:

```js
{
  $group: {
    _id: "$userId",

    latestOrder: {
      $first: "$_id"
    }
  }
}
```

Because we sorted newest first:

```text
$first = newest order
```

If sorted ascending:

```text
$first = oldest order
```

## Important interview rule

> `$first` and `$last` only make sense when you understand the order of documents entering the `$group`.

## Try it

```js
db.orders.aggregate([
  { $sort: { createdAt: -1 } },
  {
    $group: {
      _id: "$userId",
      latestOrder: { $first: "$_id" },
      latestAt: { $first: "$createdAt" }
    }
  },
  { $sort: { _id: 1 } },
  { $limit: 5 }
])
```

Now change the first `$sort` to `createdAt: 1` and run it again. Not one character of the `$group` changed, and every answer did.
