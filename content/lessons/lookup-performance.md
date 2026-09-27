---
title: 'What $lookup costs'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'What $lookup actually costs in MongoDB, why it runs per document, and when embedding beats joining.'
topics: ['$lookup']
source: 'batch3.md:364-405'
---

Syntax is the easy half. The question that separates answers is what `$lookup` costs - it runs once per input document, which is why filtering before the join matters so much, and why embedding is often the better design.

Be able to say:

> `$lookup` can become expensive, especially with large collections or poor join-field indexing.

If you're doing:

```text
orders.userId
→
users._id
```

`users._id` is already indexed.

But for:

```text
orders.userId
→
users.externalUserId
```

you probably want an index on:

```js
{ externalUserId: 1 }
```

Also:

* Filter before `$lookup` when possible.
* Return only needed data.
* Avoid joining huge unnecessary datasets.
* Consider schema design: sometimes embedding is better than repeatedly joining.
* `$lookup` is not automatically "bad"; the access pattern and data volume matter.

## Try it

Filtered down to five documents *before* the join:

```js
db.orders.aggregate([
  { $match: { status: "completed" } },
  { $limit: 5 },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  },
  {
    $project: {
      status: 1,
      "user.name": 1
    }
  }
])
```

Move `{ $limit: 5 }` to the end and the answer is identical - but the join ran against every completed order to produce the same five rows. Browser mode has no `explain()`, so you cannot see the cost here; the point is that the stage order, not the output, is what changed.
