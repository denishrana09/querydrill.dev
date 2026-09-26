---
title: '$map, and how it differs from $unwind'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $map transforms every element of an array in place, keeping the document intact. The $unwind you often do not need.'
operators: ['$map', '$multiply', '$project', '$unwind']
source: 'batch3.md:531-684'
---

`$map` applies an expression to every element of an array and gives you a new array back. It is the operator that lets you compute per-element values without `$unwind` scattering your document across many.

Suppose:

```js
{
  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 2
    },
    {
      product: "Mouse",
      price: 50,
      quantity: 3
    }
  ]
}
```

You want:

```js
[
  {
    product: "Laptop",
    total: 2000
  },
  {
    product: "Mouse",
    total: 150
  }
]
```

Use `$map`.

```js
{
  $project: {
    items: {
      $map: {
        input: "$items",
        as: "item",

        in: {
          product: "$$item.product",

          total: {
            $multiply: [
              "$$item.price",
              "$$item.quantity"
            ]
          }
        }
      }
    }
  }
}
```

Mental model:

```text
Array

[A, B, C]

$map

A → transformed A
B → transformed B
C → transformed C
```

Basically:

```js
array.map(...)
```

from JavaScript.

## `$map` vs `$unwind`

This distinction is important.

Suppose:

```text
items[]
```

## Use `$map`

When you want to:

```text
Keep the array
but transform its elements.
```

Example:

```text
items[]

↓ calculate totals

itemsWithTotal[]
```

## Use `$unwind`

When you want:

```text
One pipeline document per array element.
```

Example:

```text
Order
  ├── Laptop
  └── Mouse

↓

Order + Laptop
Order + Mouse

↓

$group by product
```

Remember:

```text
Keep array structure
→ $map / $filter

Break array into documents
→ $unwind
```

## Try it

```js
db.orders.aggregate([
  {
    $project: {
      _id: 0,
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: {
            product: "$$item.product",
            total: {
              $multiply: ["$$item.price", "$$item.quantity"]
            }
          }
        }
      }
    }
  },
  { $limit: 3 }
])
```

Three documents in, three out, each with a rebuilt array. `$unwind` would have given you one document per item instead.
