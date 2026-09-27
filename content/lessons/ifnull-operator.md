---
title: '$ifNull and missing fields'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $ifNull supplies a default when a field is missing or null, so arithmetic on optional fields does not break.'
topics: ['$ifNull', '$project']
source: 'batch3.md:946-990'
---

Optional fields are normal in MongoDB, and arithmetic on a field that is not there does not do what you want. `$ifNull` substitutes a default, and it belongs anywhere you compute with a field that will not always exist.

Suppose:

```js
{
  name: "Denish"
}
```

No `nickname`.

You want:

```text
nickname = "Anonymous"
```

if it doesn't exist.

```js
{
  $project: {
    name: 1,

    nickname: {
      $ifNull: [
        "$nickname",
        "Anonymous"
      ]
    }
  }
}
```

Mental model:

```js
nickname ?? "Anonymous"
```

Useful when dealing with optional fields.

## Try it

Half the orders in the sample data have no `rating`:

```js
db.orders.aggregate([
  {
    $project: {
      rating: 1,
      ratingOrDefault: { $ifNull: ["$rating", "not rated"] }
    }
  },
  { $limit: 6 }
])
```

Compare the two fields on the rows where `rating` is missing. The first one is simply absent from the output - that is what your arithmetic would have been handed.
