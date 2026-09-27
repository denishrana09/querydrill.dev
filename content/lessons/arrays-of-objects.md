---
title: 'Arrays of objects'
module: 'nested-and-arrays'
track: 'fundamentals'
description: 'Querying arrays of sub-documents in MongoDB with dot notation, and what a match on "orders.status" actually tests.'
topics: ['arrays', 'find', 'nested']
source: 'batch1.md:321-355'
---

An array of objects is the shape you meet most often in real data - order line items, addresses, comments. Dot notation reaches into it, but what it matches is looser than it looks, which is what the next lesson is about.

Example:

```js
{
  name: "Denish",

  orders: [
    {
      product: "Laptop",
      price: 1000,
      status: "completed"
    },
    {
      product: "Mouse",
      price: 50,
      status: "pending"
    }
  ]
}
```

## Basic matching

```js
db.users.find({
  "orders.product": "Laptop"
})
```

Finds the document if **any order** has product `Laptop`.
