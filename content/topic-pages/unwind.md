---
title: 'MongoDB $unwind'
topic: '$unwind'
description: 'MongoDB $unwind turns one document with an array into one document per element. Run it below and watch the document count change, then practise it.'
lede: 'One document in, one document per array element out — which is the whole operator, and also the whole problem.'
---

`$unwind` flattens an array field. A document whose `items` array holds three entries becomes three documents, identical except that each one carries a single `items` object instead of the array.

Run this and read the row count rather than the rows:

```js
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $unwind: "$items" },
  { $project: { _id: 1, userId: 1, items: 1 } }
])
```

One order went in. More than one came out, and each result still claims `_id: 1` — because `$unwind` does not create new orders, it creates new *rows about* one order.

That is the source of nearly every `$unwind` bug:

**Counts after an `$unwind` are counts of line items, not of orders.** `{ $sum: 1 }` following an unwind answers "how many item entries", which is a perfectly good question and almost never the one that was asked. If you want orders, group back by `$_id` first, or do not unwind at all.

**Sums need the multiply.** After unwinding, each row holds one item, so revenue is `price × quantity` per row and then summed. Summing `price` alone is the classic slip, and it silently returns a smaller, entirely plausible number.

**An empty array makes the document vanish.** No elements, no rows. `preserveNullAndEmptyArrays: true` keeps it, which matters after a `$lookup` that found nothing.

The pairing with `$group` is so common that it has its own module below. The exercises make you decide which side of the unwind the grouping belongs on.
