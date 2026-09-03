---
title: 'Paging and total count in one query'
module: 'facets-and-dates'
track: 'advanced-aggregation'
description: 'Get a page of MongoDB results and the total count in one query, using $facet with $skip/$limit and $count.'
operators: ['$count', '$facet', '$limit', '$match', '$skip', '$sort']
source: 'batch3.md:1195-1261'
---

Every paginated API needs the same two things: this page of rows, and how many rows there are in total. `$facet` gets both in one query instead of two, and this is the single most reused `$facet` recipe there is.

Suppose your API needs:

```json
{
  "data": [...],
  "total": 1000
}
```

You can do:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $facet: {
      data: [
        {
          $sort: {
            createdAt: -1
          }
        },
        {
          $skip: 20
        },
        {
          $limit: 10
        }
      ],

      total: [
        {
          $count: "count"
        }
      ]
    }
  }
])
```

Output:

```js
{
  data: [
    // 10 orders
  ],

  total: [
    {
      count: 1000
    }
  ]
}
```

This is a pattern worth remembering.
