---
title: 'Grouping by more than one field'
module: 'grouping'
track: 'aggregation'
description: 'Group by more than one field in MongoDB by making $group _id an object, and how that changes the shape of your results.'
operators: ['$group', '$sum']
source: 'batch2.md:1159-1273'
---

Grouping by two fields is just an object as the `_id`. The part that catches people is the output: your grouping key is now nested inside `_id`, so every later stage has to reach through it.

Suppose:

> Find quantity sold per user per product.

You can group by an object.

```js
{
  $group: {
    _id: {
      userId: "$userId",
      product: "$items.product"
    },

    quantity: {
      $sum: "$items.quantity"
    }
  }
}
```

Result:

```js
{
  _id: {
    userId: 101,
    product: "Laptop"
  },

  quantity: 1
}
```

This is equivalent conceptually to:

```sql
GROUP BY userId, product
```

## The `$group` `_id` Is Just the Grouping Key

This confuses many people initially.

Here:

```js
{
  $group: {
    _id: "$userId"
  }
}
```

`_id` does **not** mean the original document ID.

Inside `$group`:

> `_id` means "what am I grouping by?"

Examples:

```js
_id: "$userId"
```

Group by user.

```js
_id: "$items.product"
```

Group by product.

```js
_id: null
```

Everything goes into **one group**.

Example:

```js
{
  $group: {
    _id: null,

    totalRevenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: null,
  totalRevenue: 50000
}
```

Meaning:

> Calculate one total across all documents.

This is a common interview pattern.
