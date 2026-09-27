---
title: 'find() vs aggregate()'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'find() vs aggregate() in MongoDB: what find can and cannot do, and the point at which you need a pipeline.'
topics: ['find', '$group', '$gte', '$match', '$sum']
source: 'batch1.md:850-943'
---

Before touching aggregation, it is worth being precise about what `find()` already does, because a lot of people reach for a pipeline they do not need - and a lot of others try to force `find()` to do something it structurally cannot.

Use `find()` when you're basically:

```text
Filter documents
Sort
Project fields
Paginate
```

Example:

```js
db.users.find(
  {
    status: "active",
    age: { $gte: 25 }
  },
  {
    name: 1,
    email: 1
  }
)
.sort({
  createdAt: -1
})
.limit(10)
```

Use `aggregate()` when you're doing:

```text
Grouping
Calculations
Transformations
Joining collections
Complex array manipulation
Analytics/reporting
Multi-stage processing
```

Example:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },
  {
    $group: {
      _id: "$userId",
      totalSpent: {
        $sum: "$amount"
      }
    }
  }
])
```

Don't worry about understanding every part yet.

Just notice:

```text
find()

Document → Filter → Return documents
```

vs:

```text
aggregate()

Documents
   ↓
Stage 1
   ↓
Stage 2
   ↓
Stage 3
   ↓
Transformed result
```

Aggregation is a **pipeline**.
