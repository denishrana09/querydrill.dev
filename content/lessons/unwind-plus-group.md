---
title: '$unwind + $group'
module: 'unwind-arrays'
track: 'aggregation'
description: 'The $unwind then $group pattern: flatten an array, then aggregate its elements. The most reusable pipeline in MongoDB.'
topics: ['$group', '$match', '$sum', '$unwind']
source: 'batch2.md:923-1071'
---

This is the pattern worth memorising outright. `$match` to cut the data down, `$unwind` to flatten the array, `$group` to aggregate the elements, `$sort` to rank the result - a large share of real aggregation questions are this shape with different field names.

Now we can solve:

> Total quantity sold per product.

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $unwind: "$items"
  },

  {
    $group: {
      _id: "$items.product",

      totalQuantity: {
        $sum: "$items.quantity"
      }
    }
  }
])
```

Let's walk through it.

## Stage 1 — `$match`

```text
Only completed orders

Order 1
Order 2
Order 3
```

## Stage 2 — `$unwind`

```text
Order 1 → Laptop
Order 1 → Mouse
Order 2 → Keyboard
Order 3 → Laptop
```

Now the data looks conceptually like:

```text
Laptop
Mouse
Keyboard
Laptop
```

## Stage 3 — `$group`

```text
Laptop
  quantity: 1 + 1 = 2

Mouse
  quantity: 2

Keyboard
  quantity: 1
```

Result:

```js
[
  {
    _id: "Laptop",
    totalQuantity: 2
  },
  {
    _id: "Mouse",
    totalQuantity: 2
  },
  {
    _id: "Keyboard",
    totalQuantity: 1
  }
]
```

## 🚨 This Pattern Is Extremely Important

Memorize the **concept**, not the code:

```text
Array of things

Need to analyze each thing individually?

        ↓

$unwind

        ↓

Now each array item behaves like
an individual pipeline document

        ↓

$group / $match / calculations
```

Examples:

```text
Order
 └── items[]
```

```text
User
 └── skills[]
```

```text
Post
 └── comments[]
```

```text
Invoice
 └── lineItems[]
```

Whenever the question is about **individual elements inside an array**, `$unwind` should enter your mind.
