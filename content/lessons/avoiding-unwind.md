---
title: 'When you do not need $unwind'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'When you do not need $unwind in MongoDB: compute inside the document with $map, $filter and $sum instead of flattening it.'
operators: ['$add', '$multiply', '$reduce', '$set', '$unwind']
source: 'batch3.md:1528-1607'
---

`$unwind` is not free, and it is not always necessary. If the answer you want stays within a single document, the expression operators can compute it without ever splitting that document apart - and knowing when to choose which is a genuine interview discriminator.

Question:

> Calculate the total value of every order.

You have:

```js
{
  items: [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 }
  ]
}
```

You want to keep:

```text
One result per order.
```

Using `$unwind` would turn one order into multiple documents, then you'd need to group again.

Instead:

```text
One document
   ↓
items[]
   ↓
calculate one total

→ $reduce
```

```js
{
  $set: {
    orderTotal: {
      $reduce: {
        input: "$items",
        initialValue: 0,

        in: {
          $add: [
            "$$value",

            {
              $multiply: [
                "$$this.price",
                "$$this.quantity"
              ]
            }
          ]
        }
      }
    }
  }
}
```

## Decision:

```text
Need to keep one document per order?

→ $map / $filter / $reduce

Need each item to participate as an independent document,
especially for grouping?

→ $unwind
```
