---
title: 'How to think about an aggregation pipeline'
kind: 'reference'
description: 'A repeatable way to plan a MongoDB aggregation before writing it: six questions that decide your stages, plus five patterns worth recognising on sight.'
source: 'batch2.md:1465-1559, batch2.md:1689-1806'
---

Most people write pipelines by trial and error. These six questions decide the stages before you type anything - answer them in order and the pipeline usually falls out. The patterns after them are the shapes that recur often enough to recognise on sight.

For almost every question, ask these in order:

## Question 1: Which documents do I need?

```text
$match
```

Example:

> Only completed orders from 2026.

## Question 2: Is the data I need inside an array?

```text
$unwind
```

Example:

> Analyze products inside `items`.

## Question 3: Do I need to combine multiple documents?

```text
$group
```

Example:

> Revenue per product.

## Question 4: Do I need calculated fields?

```text
$project
or
$set
or expressions inside $group
```

Example:

```text
price × quantity
```

## Question 5: How should the result look?

```text
$project
```

Example:

Instead of:

```js
{
  _id: "Laptop",
  revenue: 2000
}
```

You might want:

```js
{
  product: "Laptop",
  revenue: 2000
}
```

## Question 6: Do I need ranking/pagination?

```text
$sort
$skip
$limit
```

## Rapid pattern recognition

Worth being able to map on sight:

| Problem                          | Think                        |
| -------------------------------- | ---------------------------- |
| Filter documents                 | `$match`                     |
| Keep/rename/calculate fields     | `$project`                   |
| Add a calculated field           | `$set`                       |
| Analyze elements inside an array | `$unwind`                    |
| Count/sum/average by something   | `$group`                     |
| Order results                    | `$sort`                      |
| Top N                            | `$sort` → `$limit`           |
| Pagination                       | `$sort` → `$skip` → `$limit` |
| One overall total                | `$group: { _id: null }`      |

## The five patterns worth memorising

## Pattern 1 — Count by X

```js
[
  {
    $group: {
      _id: "$someField",
      count: { $sum: 1 }
    }
  }
]
```

## Pattern 2 — Sum by X

```js
[
  {
    $group: {
      _id: "$someField",
      total: {
        $sum: "$amount"
      }
    }
  }
]
```

## Pattern 3 — Array analytics

```js
[
  {
    $unwind: "$items"
  },

  {
    $group: {
      _id: "$items.product",
      count: { $sum: 1 }
    }
  }
]
```

## Pattern 4 — Top N

```js
[
  {
    $group: {
      _id: "$category",
      total: {
        $sum: "$amount"
      }
    }
  },

  {
    $sort: {
      total: -1
    }
  },

  {
    $limit: 5
  }
]
```

## Pattern 5 — Filter → Transform → Group → Sort

This is probably the most common pattern:

```text
$match
   ↓
$unwind / $project / $set
   ↓
$group
   ↓
$project
   ↓
$sort
   ↓
$limit
```
