---
title: 'Counting and summing'
module: 'grouping'
track: 'aggregation'
description: 'Count documents and sum fields per group in MongoDB with $group and $sum, including the $sum: 1 counting idiom.'
topics: ['$group', '$sum']
source: 'batch2.md:583-674'
---

Counting and summing are the two things you will do with `$group` more than everything else combined. They are the same operator: `$sum: 1` counts, `$sum: "$field"` totals.

Now let's count orders per user.

```js
{
  $group: {
    _id: "$userId",

    orderCount: {
      $sum: 1
    }
  }
}
```

Result:

```js
[
  {
    _id: 101,
    orderCount: 2
  },
  {
    _id: 102,
    orderCount: 1
  }
]
```

Mental translation:

```text
Group by userId

For every document:
  add 1
```

This is very similar to:

```sql
GROUP BY userId
COUNT(*)
```

## Sum a field

Suppose documents:

```js
{
  userId: 101,
  amount: 500
}
```

```js
{
  userId: 101,
  amount: 300
}
```

Pipeline:

```js
{
  $group: {
    _id: "$userId",

    totalSpent: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: 101,
  totalSpent: 800
}
```

## Try it

```js
db.orders.aggregate([
  {
    $group: {
      _id: "$userId",
      orderCount: { $sum: 1 }
    }
  },
  { $sort: { orderCount: -1 } },
  { $limit: 5 }
])
```

The busiest five users. Change `$sum: 1` to `$sum: "$rating"` and the same pipeline totals a field instead of counting documents.
