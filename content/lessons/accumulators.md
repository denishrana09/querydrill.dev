---
title: 'The accumulator operators'
module: 'grouping'
track: 'aggregation'
description: 'The MongoDB $group accumulators: $sum, $avg, $min, $max, $count, $push, $addToSet, $first and $last.'
operators: ['$avg', '$group', '$max', '$min', '$sum']
source: 'batch2.md:675-717'
---

An accumulator is what you compute for each group. MongoDB ships a long list of them; this lesson covers the working set rather than the reference manual.

These are the ones worth knowing cold:

```text
$sum
$avg
$min
$max
$push
$addToSet
$first
$last
```

Example:

```js
{
  $group: {
    _id: "$userId",

    total: {
      $sum: "$amount"
    },

    average: {
      $avg: "$amount"
    },

    biggestOrder: {
      $max: "$amount"
    },

    smallestOrder: {
      $min: "$amount"
    }
  }
}
```

## Try it

Four of them at once, per user:

```js
db.orders.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$userId",
      total: {
        $sum: {
          $multiply: ["$items.price", "$items.quantity"]
        }
      },
      average: { $avg: "$items.price" },
      biggest: { $max: "$items.price" },
      smallest: { $min: "$items.price" }
    }
  },
  { $sort: { total: -1 } },
  { $limit: 5 }
])
```

One pass over the data produces all four. They are not four queries.
