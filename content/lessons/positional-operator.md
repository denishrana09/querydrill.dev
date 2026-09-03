---
title: 'The positional $ operator'
module: 'updating-arrays'
track: 'fundamentals'
description: 'Update an object inside a MongoDB array with the positional $ operator, which targets the element your filter matched.'
operators: ['$set']
source: 'batch1.md:780-849'
---

You have an array of objects and you want to change one of them, in place, without reading the document first. The positional `$` is how - it stands for "the index the query filter matched".

Given:

```js
{
  _id: 1,

  orders: [
    {
      _id: 101,
      product: "Laptop",
      status: "pending"
    },
    {
      _id: 102,
      product: "Mouse",
      status: "pending"
    }
  ]
}
```

Update order `101`:

```js
db.users.updateOne(
  {
    _id: 1,
    "orders._id": 101
  },
  {
    $set: {
      "orders.$.status": "completed"
    }
  }
)
```

The `$` here refers to the **matched array element**.

This is useful to remember.

There are also:

```text
$        → first matching element

$[]      → all elements

$[x]     → filtered elements
```

Example:

```js
db.users.updateOne(
  { _id: 1 },
  {
    $set: {
      "orders.$[].status": "archived"
    }
  }
)
```

Updates all array elements.
