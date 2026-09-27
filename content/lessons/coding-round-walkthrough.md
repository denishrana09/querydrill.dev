---
title: 'A full coding-round problem, worked'
module: 'facets-and-dates'
track: 'advanced-aggregation'
description: 'A full MongoDB aggregation interview problem worked end to end: top customers by spend, joined to their user records.'
topics: ['$group', '$limit', '$lookup', '$match', '$multiply', '$project', '$sort', '$sum', '$unwind']
source: 'batch3.md:1356-1527'
---

One realistic coding-round problem, from reading the question to the finished pipeline. The useful part is not the answer - it is the order the stages get decided in, before a single line is written.

Collections:

## `users`

```js
{
  _id: 101,
  name: "Denish",
  country: "India"
}
```

## `orders`

```js
{
  _id: 1,
  userId: 101,
  status: "completed",

  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 1
    }
  ]
}
```

Question:

> Find the top 5 users by total completed-order spending, including their names.

## Think first

## What documents?

```text
Completed orders

→ $match
```

## Calculate order/item revenue?

Items are arrays.

We could:

```text
$unwind
→ one document per item
```

## Combine spending per user?

```text
$group
```

## Get user information?

```text
$lookup
```

## User object is one result?

```text
$unwind
```

## Rank?

```text
$sort
→ $limit
```

## Pipeline

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
      _id: "$userId",

      totalSpent: {
        $sum: {
          $multiply: [
            "$items.price",
            "$items.quantity"
          ]
        }
      }
    }
  },

  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user"
    }
  },

  {
    $unwind: "$user"
  },

  {
    $project: {
      _id: 0,

      userId: "$_id",
      name: "$user.name",
      totalSpent: 1
    }
  },

  {
    $sort: {
      totalSpent: -1
    }
  },

  {
    $limit: 5
  }
])
```

This looks long.

But it is just:

```text
Completed orders
        ↓
Individual items
        ↓
Revenue per user
        ↓
Join users
        ↓
Format result
        ↓
Top 5
```
