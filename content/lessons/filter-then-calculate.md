---
title: 'Filter an array, then calculate'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'A common MongoDB pattern: $filter an array down to the elements you care about, then $map and $sum over just those.'
operators: ['$add', '$eq', '$filter', '$multiply', '$reduce', '$set']
source: 'batch3.md:1608-1707'
---

Narrow the array first, then compute over what is left. Written as a nested expression it looks dense, so it is worth building up one layer at a time - the shape recurs constantly once you recognise it.

Suppose:

```js
{
  _id: 1,

  items: [
    {
      product: "Laptop",
      category: "Electronics",
      price: 1000,
      quantity: 1
    },
    {
      product: "Book",
      category: "Books",
      price: 20,
      quantity: 2
    }
  ]
}
```

Question:

> Calculate the total value of Electronics items in each order.

Think:

```text
items[]

↓ keep only Electronics

$filter

↓

Calculate total

$reduce
```

Conceptually:

```text
filter
→ reduce
```

Example:

```js
{
  $set: {
    electronics: {
      $filter: {
        input: "$items",
        as: "item",

        cond: {
          $eq: [
            "$$item.category",
            "Electronics"
          ]
        }
      }
    }
  }
},
{
  $set: {
    electronicsTotal: {
      $reduce: {
        input: "$electronics",
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

This pattern is good to understand even if you wouldn't always write it exactly this way.

## Try it

Filter the array, then reduce what survived:

```js
db.orders.aggregate([
  {
    $project: {
      electronicsTotal: {
        $reduce: {
          input: {
            $filter: {
              input: "$items",
              as: "item",
              cond: { $eq: ["$$item.category", "Electronics"] }
            }
          },
          initialValue: 0,
          in: {
            $add: [
              "$$value",
              { $multiply: ["$$this.price", "$$this.quantity"] }
            ]
          }
        }
      }
    }
  },
  { $limit: 5 }
])
```

Read it inside out and it is two steps, not one dense expression. Orders with no Electronics come back as `0`, not missing - `initialValue` decided that.
