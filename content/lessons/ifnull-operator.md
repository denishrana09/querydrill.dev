---
title: '$ifNull and missing fields'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $ifNull supplies a default when a field is missing or null, so arithmetic on optional fields does not break.'
operators: ['$ifNull', '$project']
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
