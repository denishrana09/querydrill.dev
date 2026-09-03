---
title: '$project and computed fields'
module: 'aggregation-pipeline'
track: 'aggregation'
description: 'MongoDB $project reshapes documents: include and exclude fields, rename them, and build new computed fields.'
operators: ['$multiply', '$project']
source: 'batch2.md:255-379'
---

`$project` decides what a document looks like coming out of a stage. It does the job of a projection in `find()`, and then keeps going - it can rename fields and compute entirely new ones.

Suppose your document is:

```js
{
  _id: 1,
  userId: 101,
  status: "completed",
  createdAt: "...",
  internalNotes: "...",
  items: [...]
}
```

You only want:

```text
userId
status
```

```js
{
  $project: {
    userId: 1,
    status: 1
  }
}
```

Result:

```js
{
  _id: 1,
  userId: 101,
  status: "completed"
}
```

Like normal projection, `_id` is included unless excluded.

```js
{
  $project: {
    _id: 0,
    userId: 1,
    status: 1
  }
}
```

## `$project` Can Also Create Fields

This is where aggregation starts becoming interesting.

Suppose:

```js
{
  product: "Laptop",
  price: 1000,
  quantity: 2
}
```

You can calculate:

```js
{
  $project: {
    product: 1,

    total: {
      $multiply: [
        "$price",
        "$quantity"
      ]
    }
  }
}
```

Result:

```js
{
  product: "Laptop",
  total: 2000
}
```

Notice:

```js
"$price"
```

The `$` means:

> Take the value from this document's `price` field.

Compare:

```js
price
```

Literal/string conceptually.

vs:

```js
"$price"
```

Field reference.

This is one of the most important syntax rules in aggregation.
