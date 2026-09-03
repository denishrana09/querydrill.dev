---
title: '$set and $addFields'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'MongoDB $set and $addFields add computed fields while keeping everything else. The same stage under two names.'
operators: ['$multiply', '$project', '$set']
source: 'batch2.md:380-433'
---

`$addFields` and `$set` are the same stage - MongoDB added `$set` as an alias later. Both add or overwrite fields and leave the rest of the document alone, which is what separates them from `$project`.

Example:

```js
{
  $set: {
    total: {
      $multiply: [
        "$price",
        "$quantity"
      ]
    }
  }
}
```

Input:

```js
{
  product: "Laptop",
  price: 1000,
  quantity: 2
}
```

Output:

```js
{
  product: "Laptop",
  price: 1000,
  quantity: 2,
  total: 2000
}
```

Whereas `$project` can reshape what fields remain.

A useful mental model:

```text
$project
→ "What should the output look like?"

$set / $addFields
→ "Add or modify this field"
```
