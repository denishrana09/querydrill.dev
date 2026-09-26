---
title: 'Grouping by date'
module: 'facets-and-dates'
track: 'advanced-aggregation'
description: 'Group MongoDB documents by date: $year, $month, $dayOfMonth and $dateToString for readable month labels.'
operators: ['$dateToString', '$group', '$month', '$sort', '$sum', '$year']
source: 'batch3.md:1262-1355'
---

Reporting questions are almost always date questions - per day, per month, per year. There are two ways to group by date, and the choice between them is really a choice about what you want the output label to look like.

You will almost certainly encounter:

> Group sales by month.

Suppose:

```js
{
  createdAt: ISODate("2026-01-15"),
  amount: 500
}
```

You can group by year and month:

```js
{
  $group: {
    _id: {
      year: {
        $year: "$createdAt"
      },

      month: {
        $month: "$createdAt"
      }
    },

    revenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: {
    year: 2026,
    month: 1
  },

  revenue: 5000
}
```

## `$dateToString`

Often cleaner for output:

```js
{
  $group: {
    _id: {
      $dateToString: {
        format: "%Y-%m",
        date: "$createdAt"
      }
    },

    revenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: "2026-01",
  revenue: 5000
}
```

Then:

```js
{
  $sort: {
    _id: 1
  }
}
```

## Try it

```js
db.orders.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" }
      },
      orders: { $sum: 1 }
    }
  },
  { $sort: { "_id.year": 1, "_id.month": 1 } }
])
```

The label is an object, so sorting means reaching through `_id`. Try `$dateToString` instead and the label becomes `"2025-11"` - one string, sortable on its own.
