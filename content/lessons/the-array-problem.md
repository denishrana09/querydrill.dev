---
title: 'Why $group cannot see inside arrays'
module: 'unwind-arrays'
track: 'aggregation'
description: 'Why MongoDB $group cannot reach values inside an array, and the shape of the problem $unwind exists to solve.'
operators: ['$group', '$sum', '$unwind']
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
