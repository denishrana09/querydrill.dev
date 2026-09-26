---
title: '$push vs $addToSet inside $group'
module: 'grouping'
track: 'aggregation'
description: 'MongoDB $push vs $addToSet inside $group: collect every value, or collect the distinct ones. Pair $addToSet with $size to count them.'
operators: ['$addToSet', '$push']
source: 'batch2.md:718-778'
---

Same distinction as the array update operators, in a different place: `$push` collects every value it sees, `$addToSet` collects the distinct ones. Combining `$addToSet` with `$size` is the standard way to count distinct values per group.

Suppose:

```text
User 101 bought:

Laptop
Mouse
Laptop
```

## `$push`

```js
products: {
  $push: "$product"
}
```

Result:

```js
[
  "Laptop",
  "Mouse",
  "Laptop"
]
```

## `$addToSet`

```js
products: {
  $addToSet: "$product"
}
```

Result:

```js
[
  "Laptop",
  "Mouse"
]
```

Remember:

```text
$push
→ keep duplicates

$addToSet
→ unique values
```

## Try it

Both, side by side, so the difference is in one output:

```js
db.orders.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$userId",
      all: { $push: "$items.product" },
      distinct: { $addToSet: "$items.product" }
    }
  },
  { $limit: 3 }
])
```

`all` has the repeats; `distinct` does not. Wrap the second one in `$size` and you have a count of distinct products per user.
