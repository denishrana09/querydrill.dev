---
title: '$elemMatch and the multi-condition trap'
module: 'nested-and-arrays'
track: 'fundamentals'
description: 'The classic MongoDB array trap: two conditions on an array of objects can match different elements. $elemMatch is the fix.'
topics: ['arrays', 'find', '$elemMatch']
source: 'batch1.md:356-432'
---

This is the single most common MongoDB mistake, and it is a favourite interview question because the wrong query still returns results. Two conditions on the same array path are *not* required to be satisfied by the same element.

Consider:

```js
db.users.find({
  "orders.product": "Laptop",
  "orders.status": "completed"
})
```

You might think this means:

> Find a user having an order where product is Laptop AND status is completed.

Not necessarily.

MongoDB can match:

```js
[
  {
    product: "Laptop",
    status: "pending"
  },
  {
    product: "Mouse",
    status: "completed"
  }
]
```

Because one array element satisfies:

```text
product = Laptop
```

And another satisfies:

```text
status = completed
```

## Correct: `$elemMatch`

```js
db.users.find({
  orders: {
    $elemMatch: {
      product: "Laptop",
      status: "completed"
    }
  }
})
```

Now MongoDB ensures:

```text
THE SAME ARRAY ELEMENT

product = Laptop
AND
status = completed
```

This is a **very common interview question**.

Remember:

> Multiple conditions that must apply to the same array object → `$elemMatch`.
