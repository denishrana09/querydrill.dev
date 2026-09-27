---
title: 'MongoDB $group'
topic: '$group'
description: 'MongoDB $group is GROUP BY for the aggregation pipeline. Run a real grouping below, then work through the lessons and exercises that build on it.'
lede: 'The stage that collapses many documents into one per key — and the two rules that decide what survives the collapse.'
---

`$group` takes every document flowing through the pipeline and collapses them into one output document per distinct key. It is the closest thing MongoDB has to `GROUP BY`, and it is the stage most pipelines are built around.

```js
db.orders.aggregate([
  { $group: { _id: "$status", orders: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
  { $sort: { orders: -1 } }
])
```

Two rules govern everything `$group` does, and between them they explain most of the errors:

**`_id` is the grouping key, not an identifier.** Whatever you put there defines the buckets. `"$status"` gives one row per status; `null` gives exactly one row over the whole collection; an object like `{ userId: "$userId", status: "$status" }` gives one row per combination. The name is unfortunate — it has nothing to do with the `_id` of the incoming documents, which is why a grouped result cannot be fed back into `updateOne` without more work.

**Every other output field must be an accumulator.** `$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`. There is no "just carry this field through", because the stage is looking at many documents and has to be told which one's value to keep. Naming a bare field is an error, not a passthrough.

Two details worth knowing before the exercises. `$avg` and `$min` **skip missing fields** rather than treating them as zero — so `avgRating` above is the average over the half of the orders that have a rating, which is usually what you want and occasionally is not. And `$first` is only meaningful after an explicit `$sort`; without one it takes whichever document happened to arrive first.
