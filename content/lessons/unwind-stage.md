---
title: '$unwind'
module: 'unwind-arrays'
track: 'aggregation'
description: 'MongoDB $unwind turns one document with an N-element array into N documents, so later stages can work on each element.'
topics: ['$unwind']
source: 'batch2.md:839-922'
---

`$unwind` flattens an array into separate documents - one per element, each carrying a copy of the parent fields. Once you can picture that output, the rest of aggregation over arrays follows.

Input:

```js
{
  _id: 1,

  userId: 101,

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

Pipeline:

```js
{
  $unwind: "$items"
}
```

Output:

```js
{
  _id: 1,
  userId: 101,

  items: {
    product: "Laptop",
    price: 1000,
    quantity: 1
  }
}
```

AND:

```js
{
  _id: 1,
  userId: 101,

  items: {
    product: "Mouse",
    price: 50,
    quantity: 2
  }
}
```

One document became **two documents**.

This is the key idea:

```text
Before $unwind

Order
 ├── Laptop
 └── Mouse

After $unwind

Order + Laptop

Order + Mouse
```

## Try it

Order `1` in the sample data has four items:

```js
db.orders.aggregate([
  { $match: { _id: 1 } },
  { $unwind: "$items" }
])
```

Four documents came out, each carrying the same `_id`, `userId` and `status` - and one item. Change the `_id` and the number of output documents follows the array length.
