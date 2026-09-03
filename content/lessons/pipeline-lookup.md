---
title: 'Pipeline $lookup with let and $expr'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'MongoDB pipeline $lookup with let and $expr: filter the joined collection during the join, not after it.'
operators: ['$and', '$eq', '$expr', '$lookup', '$match']
source: 'batch3.md:234-363'
---

The basic `$lookup` can only match one field against another. The pipeline form runs a whole sub-pipeline against the foreign collection, which means you can filter *during* the join - and it is the form interviewers ask about.

Suppose:

```text
users
orders
```

Question:

> For each user, find only their completed orders.

You can use a pipeline inside `$lookup`.

```js
{
  $lookup: {
    from: "orders",

    let: {
      userId: "$_id"
    },

    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              {
                $eq: [
                  "$userId",
                  "$$userId"
                ]
              },
              {
                $eq: [
                  "$status",
                  "completed"
                ]
              }
            ]
          }
        }
      }
    ],

    as: "orders"
  }
}
```

This looks scary, but break it down.

## `let`

```js
let: {
  userId: "$_id"
}
```

For the current user:

```text
Current document:

{
  _id: 101,
  name: "Denish"
}
```

We create:

```text
$$userId = 101
```

## `$expr`

Normally:

```js
{
  userId: 101
}
```

compares a field against a fixed value.

But here we want:

```text
orders.userId
=
current user's _id
```

So we need expressions:

```js
$expr: {
  $eq: [
    "$userId",
    "$$userId"
  ]
}
```

Important distinction:

```text
$field
→ field from current pipeline document

$$variable
→ aggregation variable
```

This `$lookup` pattern is worth knowing.
