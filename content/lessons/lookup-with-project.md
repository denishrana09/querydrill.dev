---
title: 'Trimming the joined document'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'Trim a MongoDB $lookup result with $project so you return two or three joined fields instead of a whole document.'
operators: ['$lookup', '$match', '$project', '$unwind']
source: 'batch3.md:183-233'
---

A join drags the entire matched document into your result, which is rarely what you want to return. `$project` after the join is how you keep the two fields you actually need.

Question:

> Return each completed order with the user's name.

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  },

  {
    $unwind: "$user"
  },

  {
    $project: {
      _id: 1,
      amount: 1,
      userName: "$user.name"
    }
  }
])
```

Read it:

```text
Find completed orders
        ↓
Join the user
        ↓
Convert user[] → user
        ↓
Return only what I need
```
