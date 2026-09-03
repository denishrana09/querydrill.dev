---
title: '$match, and why it goes first'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'MongoDB $match filters documents inside an aggregation pipeline, using the same operators as find(). Put it first.'
operators: ['$gte', '$lt', '$match']
source: 'batch2.md:150-254'
---

Of all the stages, this is the one whose *position* matters most: every document `$match` removes is a document no later stage has to look at. The syntax itself you already know.

This is basically:

```js
find()
```

but inside an aggregation pipeline.

## Example

Find completed orders:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  }
])
```

Input:

```text
Order 1 → completed
Order 2 → completed
Order 3 → completed
Order 4 → pending
```

Output:

```text
Order 1
Order 2
Order 3
```

## Multiple conditions

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed",
      userId: 101
    }
  }
])
```

Exactly the same query operators work:

```js
{
  $match: {
    createdAt: {
      $gte: ISODate("2026-01-01"),
      $lt: ISODate("2026-02-01")
    }
  }
}
```

## Important Performance Rule

Usually:

> **Filter as early as possible.**

Bad conceptual pipeline:

```text
100 million documents
        ↓
$group
        ↓
$match
```

Better:

```text
100 million
   ↓
$match → 10,000
   ↓
$group
```

Why?

Because later stages process fewer documents.

It matters even more once indexes are involved: a `$match` at the front of a pipeline can use one, while the same `$match` sitting after a `$group` cannot - by then the documents it is filtering did not come from the collection.
