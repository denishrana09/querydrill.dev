---
title: '$unwind after $lookup'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'Pairing $unwind with $lookup in MongoDB to turn the joined one-element array into a plain embedded object.'
topics: ['$lookup', '$unwind']
source: 'batch3.md:131-182'
---

Because `$lookup` always hands back an array, the stage that follows it is almost always `$unwind`. This pairing is common enough to be treated as a single idiom.

Classic pattern:

```js
db.orders.aggregate([
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
  }
])
```

Now:

```js
{
  _id: 1,
  userId: 101,
  amount: 1000,

  user: {
    _id: 101,
    name: "Denish"
  }
}
```

This is the common pattern:

```text
$lookup
    ↓
Returns array

$unwind
    ↓
Turns array into object
```

For one-to-one or many-to-one relationships, this is very common.
