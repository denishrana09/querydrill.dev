---
title: '$filter, and how it differs from $match'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $filter keeps some elements of an array without splitting the document apart, unlike $match or $unwind.'
operators: ['$eq', '$filter', '$match', '$project']
source: 'batch3.md:406-530'
---

`$filter` narrows an array in place. The document stays one document - which is exactly what makes it different from `$match`, which drops whole documents, and `$unwind`, which multiplies them.

Suppose:

```js
{
  userId: 101,

  orders: [
    {
      product: "Laptop",
      status: "completed"
    },
    {
      product: "Mouse",
      status: "pending"
    }
  ]
}
```

You want to keep only completed orders.

```js
{
  $project: {
    userId: 1,

    completedOrders: {
      $filter: {
        input: "$orders",
        as: "order",

        cond: {
          $eq: [
            "$$order.status",
            "completed"
          ]
        }
      }
    }
  }
}
```

Result:

```js
{
  userId: 101,

  completedOrders: [
    {
      product: "Laptop",
      status: "completed"
    }
  ]
}
```

Mental model:

```text
$filter

Take array
    ↓
Check each element
    ↓
Keep elements matching condition
```

## `$filter` vs `$match`

Very important.

```text
$match

Filters DOCUMENTS.

Document A → keep/remove
Document B → keep/remove
```

```text
$filter

Filters ARRAY ELEMENTS inside a document.

items[]
   ↓
keep/remove individual items
```

Example:

```text
Need completed orders only?
```

If each document is an order:

```text
$match
```

If orders are inside:

```text
user.orders[]
```

and you want to keep the user but filter their orders:

```text
$filter
```

This distinction is extremely useful.

## Try it

Each user in the sample data carries an embedded `orders` array:

```js
db.users.aggregate([
  {
    $project: {
      _id: 0,
      name: 1,
      completedOrders: {
        $filter: {
          input: "$orders",
          as: "order",
          cond: { $eq: ["$$order.status", "completed"] }
        }
      }
    }
  },
  { $limit: 4 }
])
```

Four users in, four users out - some with an empty array. That is the difference: `$match` would have removed those rows entirely.
