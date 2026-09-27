---
title: '$cond: if / else in a pipeline'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $cond is if/else inside an aggregation pipeline, and the basis of the conditional counting pattern.'
topics: ['$cond', '$eq', '$group', '$gte', '$project', '$sum']
source: 'batch3.md:847-945'
---

`$cond` is a ternary: a condition, a value if true, a value if false. On its own it is small; combined with `$sum` it produces the conditional counting pattern that turns one pass over a collection into several answers.

In JavaScript:

```js
condition ? A : B
```

Example:

```js
{
  $project: {
    statusLabel: {
      $cond: {
        if: {
          $gte: [
            "$amount",
            1000
          ]
        },

        then: "high-value",

        else: "normal"
      }
    }
  }
}
```

Result:

```text
amount >= 1000
        ↓
"high-value"

otherwise
        ↓
"normal"
```

## Very Common Pattern: Conditional Counting

Suppose:

> Count completed and pending orders per user.

```js
{
  $group: {
    _id: "$userId",

    completed: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$status",
              "completed"
            ]
          },
          1,
          0
        ]
      }
    },

    pending: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$status",
              "pending"
            ]
          },
          1,
          0
        ]
      }
    }
  }
}
```

Think:

```js
completed += status === "completed" ? 1 : 0
```

This is a **very useful interview pattern**.

## Try it

```js
db.products.aggregate([
  {
    $project: {
      _id: 0,
      product: 1,
      price: 1,
      tier: {
        $cond: {
          if: { $gte: ["$price", 250] },
          then: "high-value",
          else: "normal"
        }
      }
    }
  },
  { $limit: 6 }
])
```

Move the threshold and the labels move with it. No branch ran in your application - the database returned the label.
