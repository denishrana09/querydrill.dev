---
title: '$lookup, and why it returns an array'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'MongoDB $lookup is the join: pull matching documents from another collection. It always returns an array, even for one match.'
operators: ['$lookup']
source: 'batch3.md:24-130'
---

MongoDB can join, and `$lookup` is how. The detail that trips everyone on their first attempt: the joined result is always an array, even when exactly one document matched.

Suppose we have:

## `orders`

```js
{
  _id: 1,
  userId: 101,
  amount: 1000
}
```

## `users`

```js
{
  _id: 101,
  name: "Denish",
  email: "denish@example.com"
}
```

We want:

```js
{
  orderId: 1,
  amount: 1000,
  user: {
    name: "Denish"
  }
}
```

## Basic `$lookup`

```js
db.orders.aggregate([
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  }
])
```

Think:

```text
orders.userId
       ↓
matches
       ↓
users._id
```

Result:

```js
{
  _id: 1,
  userId: 101,
  amount: 1000,

  user: [
    {
      _id: 101,
      name: "Denish",
      email: "denish@example.com"
    }
  ]
}
```

## ⚠️ Important: `$lookup` Returns an Array

Even if there is only one matching user:

```js
user: [
  {
    name: "Denish"
  }
]
```

That surprises people.

If you know there is one user, you usually want:

```text
user[0]
```

There are multiple ways to handle this.
