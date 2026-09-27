---
title: 'MongoDB $map'
topic: '$map'
description: 'MongoDB $map transforms every element of an array in place, without $unwind. Run it below, and see when $filter or $reduce is the better tool.'
lede: 'Reshape an array without exploding the document — and the reason that is usually the better pipeline.'
---

`$map` walks an array and returns a new array of the same length, with each element transformed. It is an expression, not a stage, so it lives inside `$project`, `$set` or `$group` rather than standing on its own.

```js
db.orders.aggregate([
  { $match: { _id: { $in: [1, 2, 3] } } },
  { $set: {
    lineTotals: { $map: {
      input: "$items",
      as: "item",
      in: { $multiply: ["$$item.price", "$$item.quantity"] }
    } }
  } },
  { $project: { _id: 1, lineTotals: 1 } }
])
```

The `$$` is the part people get wrong. `$item` would mean "the field called `item` on the document"; `$$item` means "the variable named by `as`". Leave `as` out entirely and the variable is called `$$this`, which is shorter and reads worse.

**Why this instead of `$unwind`?** Because the document stays whole. `$unwind` turns one order into three rows and then you have to group them back together, and every count between those two points is a count of the wrong thing. `$map` computes per element and leaves you with one order carrying an array of results — which you can then `$sum` in place.

It is one of three expressions that do related jobs, and choosing between them is most of the skill:

- **`$map`** — same number of elements, each transformed.
- **`$filter`** — fewer elements, none transformed.
- **`$reduce`** — one value out of the whole array.

The comparison page in the reference section works through where each one is the right answer, and the exercises below make you pick.
