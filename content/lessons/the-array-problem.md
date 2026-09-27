---
title: 'Why $group cannot see inside arrays'
module: 'unwind-arrays'
track: 'aggregation'
description: 'Why MongoDB $group cannot reach values inside an array, and the shape of the problem $unwind exists to solve.'
topics: ['$group', '$sum', '$unwind']
source: 'batch2.md:779-838'
---

Everything so far grouped across documents. The moment the numbers you need are inside an array - order line items, for instance - `$group` cannot see them, and the pipeline you would expect to work quietly returns the wrong totals.

Back to the `orders` collection.

```js
{
  _id: 1,

  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 1
    },
    {
      product: "Mouse",
      price: 50,
      quantity: 2
    }
  ]
}
```

Suppose the question is:

> Find the total quantity sold for each product.

Your first instinct might be:

```js
{
  $group: {
    _id: "$items.product",
    totalQuantity: {
      $sum: "$items.quantity"
    }
  }
}
```

But `items` is an **array**.

You don't yet have:

```text
One document = one product
```

You have:

```text
One document = one order
```

We need to change the shape.

This is where `$unwind` comes in.

## Try it

Run the instinct first, so you have seen it fail:

```js
db.orders.aggregate([
  {
    $group: {
      _id: "$items.product",
      totalQuantity: { $sum: "$items.quantity" }
    }
  },
  { $limit: 3 }
])
```

No error. `_id` came back as a whole array of product names, and `$sum` over an array of arrays gave `0`. That is the failure mode worth remembering: it does not crash, it just answers a different question.

With `$unwind` in front:

```js
db.orders.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.product",
      totalQuantity: { $sum: "$items.quantity" }
    }
  },
  { $sort: { totalQuantity: -1 } },
  { $limit: 5 }
])
```
