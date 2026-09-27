---
title: 'MongoDB $lookup'
topic: '$lookup'
description: 'MongoDB $lookup joins two collections inside an aggregation pipeline. Run a real one below, then work through the lessons and exercises that use it.'
lede: 'The join MongoDB does have — and the three things about it that surprise people who arrived from SQL.'
---

`$lookup` pulls documents from another collection into the one you are aggregating. It is a left outer join, and it runs inside a pipeline rather than as a separate query.

Run it and look at the shape of what comes back:

```js
db.orders.aggregate([
  { $match: { _id: { $in: [1, 2] } } },
  { $lookup: {
    from: "users",
    localField: "userId",
    foreignField: "_id",
    as: "customer"
  } },
  { $project: { userId: 1, customer: 1 } }
])
```

Three things are worth noticing in that result, and each one catches somebody:

**The joined field is an array.** Always — even when exactly one document matched, as it did here. `customer` is `[{ … }]`, not `{ … }`. Every field access underneath it therefore needs `customer.name` to mean "the name of each matched user", which is a list. Most pipelines follow a `$lookup` with `$unwind` for exactly this reason.

**A miss produces `[]`, not a missing field.** Nothing is dropped. An order whose `userId` matches no user still comes through, carrying an empty array. That is what makes it a *left* join, and it is why counting after a `$lookup` counts more rows than you expect unless you say so.

**`localField`/`foreignField` is an equality match and nothing else.** The moment the join condition is a range, an `$or`, or depends on two fields at once, that form cannot express it and you need the `let` + `pipeline` form instead.

The lessons below work through each of those, and the exercises make you write the stage rather than fill one in.
