---
title: '$facet: several pipelines at once'
module: 'facets-and-dates'
track: 'advanced-aggregation'
description: 'MongoDB $facet runs several independent pipelines over the same input, returning all their results in one document.'
topics: ['$facet', '$group', '$limit', '$match', '$multiply', '$sort', '$sum', '$unwind']
source: 'batch3.md:1071-1194'
---

It sounds heavier than it is. `$facet` takes the documents reaching it and runs several separate pipelines over that same set, returning each result under its own key - one round trip, several answers.

Suppose you need:

```text
Completed order count

AND

Total revenue

AND

Top 5 products
```

Normally, you might make three aggregation queries.

`$facet` allows:

> Run multiple aggregation pipelines on the same input.

Example:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $facet: {
      orderStats: [
        {
          $group: {
            _id: null,
            totalOrders: {
              $sum: 1
            }
          }
        }
      ],

      topProducts: [
        {
          $unwind: "$items"
        },

        {
          $group: {
            _id: "$items.product",

            revenue: {
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
          $sort: {
            revenue: -1
          }
        },

        {
          $limit: 5
        }
      ]
    }
  }
])
```

Conceptually:

```text
                  Completed Orders
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓

     Order stats                   Top products
```

Output:

```js
{
  orderStats: [
    {
      _id: null,
      totalOrders: 500
    }
  ],

  topProducts: [
    {
      _id: "Laptop",
      revenue: 50000
    }
  ]
}
```

This is useful for:

```text
Dashboard APIs
Pagination + count
Analytics endpoints
Multiple metrics
```
