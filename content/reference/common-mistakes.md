---
title: 'Common aggregation mistakes'
kind: 'reference'
description: 'The four mistakes that produce wrong MongoDB aggregation results without producing an error: missing $unwind, grouping too early, and more.'
source: 'batch2.md:1560-1688'
---

What makes these dangerous is that none of them throw. The pipeline runs, returns plausible-looking numbers, and the numbers are wrong.

## Mistake 1: Forgetting `$unwind`

Question:

> Revenue per product.

Data:

```text
orders
  → items[]
```

You try grouping directly.

Ask:

> Am I analyzing the order, or each item inside the order?

If each item:

```text
Probably $unwind.
```

## Mistake 2: `$group` too early

Imagine:

```text
Need:
completed orders
```

Bad:

```text
$group everything
↓
$match completed
```

Better:

```text
$match completed
↓
$group
```

Reduce data early.

## Mistake 3: Forgetting that `$group` changes the shape

Before:

```js
{
  _id: 1,
  userId: 101,
  status: "completed"
}
```

After:

```js
{
  $group: {
    _id: "$userId",
    count: { $sum: 1 }
  }
}
```

You now have:

```js
{
  _id: 101,
  count: 5
}
```

You no longer automatically have:

```text
status
createdAt
items
```

Unless you explicitly preserve/accumulate them.

## Mistake 4: Confusing `$project` and `$group`

```text
$project

Transforms each document individually.

Document A → transformed A
Document B → transformed B
```

Whereas:

```text
$group

Combines multiple documents.

A + B + C
      ↓
Grouped result
```

This distinction is fundamental.
