---
title: 'The conditional aggregation pattern'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'The MongoDB conditional aggregation pattern: $sum with $cond to count several categories in a single pass.'
operators: ['$cond', '$eq', '$group', '$sum']
source: 'batch3.md:1708-1794'
---

One pass over the collection, several answers out. Instead of running three queries for three statuses, `$sum` with `$cond` counts each of them in the same `$group`.

Question:

> For every user, return:

```text
totalOrders
completedOrders
pendingOrders
cancelledOrders
```

You don't need four separate queries.

```js
{
  $group: {
    _id: "$userId",

    totalOrders: {
      $sum: 1
    },

    completedOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "completed"]
          },
          1,
          0
        ]
      }
    },

    pendingOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "pending"]
          },
          1,
          0
        ]
      }
    },

    cancelledOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "cancelled"]
          },
          1,
          0
        ]
      }
    }
  }
}
```

This pattern:

```text
$group
+
$sum
+
$cond
```

is worth remembering.

It is basically:

```js
if (status === "completed") {
  completed++;
}
```

inside aggregation.
