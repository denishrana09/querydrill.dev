---
title: '$reduce'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $reduce collapses an array to a single value using an accumulator, with $value and $this.'
operators: ['$add', '$multiply', '$project', '$reduce', '$set', '$unwind']
source: 'batch3.md:685-846'
---

Same idea as `reduce` in JavaScript: walk the array, carry a running value. In MongoDB that running value is `$$value` and the current element is `$$this`, and the syntax is verbose enough that it pays to read it slowly once.

In JavaScript you would write:

```js
array.reduce(...)
```

Suppose:

```js
{
  scores: [10, 20, 30]
}
```

Calculate:

```text
10 + 20 + 30
```

```js
{
  $project: {
    total: {
      $reduce: {
        input: "$scores",
        initialValue: 0,

        in: {
          $add: [
            "$$value",
            "$$this"
          ]
        }
      }
    }
  }
}
```

Conceptually:

```js
scores.reduce(
  (value, current) => value + current,
  0
)
```

MongoDB variables:

```text
$$value
→ accumulator

$$this
→ current array element
```

## Example: Order Total Without `$unwind`

Given:

```js
{
  items: [
    {
      price: 1000,
      quantity: 1
    },
    {
      price: 50,
      quantity: 2
    }
  ]
}
```

Calculate order total:

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

Result:

```text
1000 + (50 × 2)

= 1100
```

## When `$reduce` Is Actually Useful

Don't force `$reduce` everywhere.

Use it when:

> You have an array inside one document and need to calculate one value from that array.

Examples:

```text
Calculate order total
Calculate total duration
Calculate combined score
Concatenate array values
Build a custom object
```

If you need to aggregate across **multiple documents**, think:

```text
$group
```

If you need to reduce **one array**, think:

```text
$reduce
```

Very important distinction:

```text
Across documents
→ $group

Inside one array
→ $reduce
```

## Try it

```js
db.orders.aggregate([
  {
    $project: {
      itemCount: {
        $reduce: {
          input: "$items",
          initialValue: 0,
          in: { $add: ["$$value", "$$this.quantity"] }
        }
      }
    }
  },
  { $limit: 5 }
])
```

`$$value` is the running total, `$$this` is the element. Change `$add` to `$max` and the same three lines give you the largest quantity in the order instead of the sum.
