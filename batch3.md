# Batch 3 — Advanced Aggregation

This batch is about the operators that usually make MongoDB aggregation feel difficult.

We will focus on the **major patterns that are likely to appear in a coding round**:

```text
$lookup      → join collections
$map         → transform every array element
$filter      → filter elements inside an array
$reduce      → reduce an array to one value
$cond         → if/else
$ifNull       → default value
$arrayElemAt → get an array element
$size         → array length
$facet        → multiple pipelines in one query
$dateToString / $year / $month → date grouping
```

The goal is pattern recognition.

---

# 1. `$lookup` — MongoDB's Join

Suppose we have:

## `orders`

```js
{
  _id: 1,
  userId: 101,
  amount: 1000
}
```

## `users`

```js
{
  _id: 101,
  name: "Denish",
  email: "denish@example.com"
}
```

We want:

```js
{
  orderId: 1,
  amount: 1000,
  user: {
    name: "Denish"
  }
}
```

---

## Basic `$lookup`

```js
db.orders.aggregate([
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "user"
    }
  }
])
```

Think:

```text
orders.userId
       ↓
matches
       ↓
users._id
```

Result:

```js
{
  _id: 1,
  userId: 101,
  amount: 1000,

  user: [
    {
      _id: 101,
      name: "Denish",
      email: "denish@example.com"
    }
  ]
}
```

---

# ⚠️ Important: `$lookup` Returns an Array

Even if there is only one matching user:

```js
user: [
  {
    name: "Denish"
  }
]
```

That surprises people.

If you know there is one user, you usually want:

```text
user[0]
```

There are multiple ways to handle this.

---

# 2. `$unwind` After `$lookup`

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

---

# 3. `$lookup` + `$project`

Question:

> Return each completed order with the user's name.

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

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
  },

  {
    $project: {
      _id: 1,
      amount: 1,
      userName: "$user.name"
    }
  }
])
```

Read it:

```text
Find completed orders
        ↓
Join the user
        ↓
Convert user[] → user
        ↓
Return only what I need
```

---

# 4. Advanced `$lookup` — Pipeline Lookup

This is more important for interviews.

Suppose:

```text
users
orders
```

Question:

> For each user, find only their completed orders.

You can use a pipeline inside `$lookup`.

```js
{
  $lookup: {
    from: "orders",

    let: {
      userId: "$_id"
    },

    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              {
                $eq: [
                  "$userId",
                  "$$userId"
                ]
              },
              {
                $eq: [
                  "$status",
                  "completed"
                ]
              }
            ]
          }
        }
      }
    ],

    as: "orders"
  }
}
```

This looks scary, but break it down.

---

## `let`

```js
let: {
  userId: "$_id"
}
```

For the current user:

```text
Current document:

{
  _id: 101,
  name: "Denish"
}
```

We create:

```text
$$userId = 101
```

---

## `$expr`

Normally:

```js
{
  userId: 101
}
```

compares a field against a fixed value.

But here we want:

```text
orders.userId
=
current user's _id
```

So we need expressions:

```js
$expr: {
  $eq: [
    "$userId",
    "$$userId"
  ]
}
```

Important distinction:

```text
$field
→ field from current pipeline document

$$variable
→ aggregation variable
```

This `$lookup` pattern is worth knowing.

---

# 5. `$lookup` Performance Thinking

For this interview, don't just know the syntax.

Be able to say:

> `$lookup` can become expensive, especially with large collections or poor join-field indexing.

If you're doing:

```text
orders.userId
→
users._id
```

`users._id` is already indexed.

But for:

```text
orders.userId
→
users.externalUserId
```

you probably want an index on:

```js
{ externalUserId: 1 }
```

Also:

* Filter before `$lookup` when possible.
* Return only needed data.
* Avoid joining huge unnecessary datasets.
* Consider schema design: sometimes embedding is better than repeatedly joining.
* `$lookup` is not automatically "bad"; the access pattern and data volume matter.

---

# 6. `$filter` — Filter Elements Inside an Array

Suppose:

```js
{
  userId: 101,

  orders: [
    {
      product: "Laptop",
      status: "completed"
    },
    {
      product: "Mouse",
      status: "pending"
    }
  ]
}
```

You want to keep only completed orders.

```js
{
  $project: {
    userId: 1,

    completedOrders: {
      $filter: {
        input: "$orders",
        as: "order",

        cond: {
          $eq: [
            "$$order.status",
            "completed"
          ]
        }
      }
    }
  }
}
```

Result:

```js
{
  userId: 101,

  completedOrders: [
    {
      product: "Laptop",
      status: "completed"
    }
  ]
}
```

Mental model:

```text
$filter

Take array
    ↓
Check each element
    ↓
Keep elements matching condition
```

---

# `$filter` vs `$match`

Very important.

```text
$match

Filters DOCUMENTS.

Document A → keep/remove
Document B → keep/remove
```

```text
$filter

Filters ARRAY ELEMENTS inside a document.

items[]
   ↓
keep/remove individual items
```

Example:

```text
Need completed orders only?
```

If each document is an order:

```text
$match
```

If orders are inside:

```text
user.orders[]
```

and you want to keep the user but filter their orders:

```text
$filter
```

This distinction is extremely useful.

---

# 7. `$map` — Transform Each Array Element

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

---

# `$map` vs `$unwind`

This distinction is important.

Suppose:

```text
items[]
```

### Use `$map`

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

---

### Use `$unwind`

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

---

# 8. `$reduce` — Reduce an Array to One Value

This is conceptually like:

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

---

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

---

# 9. When `$reduce` Is Actually Useful

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

---

# 10. `$cond` — If / Else

MongoDB's aggregation equivalent of:

```js
condition ? A : B
```

Example:

```js
{
  $project: {
    statusLabel: {
      $cond: {
        if: {
          $gte: [
            "$amount",
            1000
          ]
        },

        then: "high-value",

        else: "normal"
      }
    }
  }
}
```

Result:

```text
amount >= 1000
        ↓
"high-value"

otherwise
        ↓
"normal"
```

---

## Very Common Pattern: Conditional Counting

Suppose:

> Count completed and pending orders per user.

```js
{
  $group: {
    _id: "$userId",

    completed: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$status",
              "completed"
            ]
          },
          1,
          0
        ]
      }
    },

    pending: {
      $sum: {
        $cond: [
          {
            $eq: [
              "$status",
              "pending"
            ]
          },
          1,
          0
        ]
      }
    }
  }
}
```

Think:

```js
completed += status === "completed" ? 1 : 0
```

This is a **very useful interview pattern**.

---

# 11. `$ifNull`

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

---

# 12. `$size`

Suppose:

```js
{
  skills: [
    "Node.js",
    "MongoDB",
    "Kafka"
  ]
}
```

```js
{
  $project: {
    skillCount: {
      $size: "$skills"
    }
  }
}
```

Result:

```js
{
  skillCount: 3
}
```

Conceptually:

```js
skills.length
```

---

# 13. `$arrayElemAt`

Suppose:

```js
{
  scores: [10, 20, 30]
}
```

Get first:

```js
{
  $arrayElemAt: [
    "$scores",
    0
  ]
}
```

Get second:

```js
{
  $arrayElemAt: [
    "$scores",
    1
  ]
}
```

Conceptually:

```js
scores[0]
```

---

# 14. `$facet` — Multiple Pipelines at Once

This one sounds complicated but is actually easy conceptually.

Suppose you need:

```text
Completed order count

AND

Total revenue

AND

Top 5 products
```

Normally, you might make three aggregation queries.

`$facet` allows:

> Run multiple aggregation pipelines on the same input.

Example:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $facet: {
      orderStats: [
        {
          $group: {
            _id: null,
            totalOrders: {
              $sum: 1
            }
          }
        }
      ],

      topProducts: [
        {
          $unwind: "$items"
        },

        {
          $group: {
            _id: "$items.product",

            revenue: {
              $sum: {
                $multiply: [
                  "$items.price",
                  "$items.quantity"
                ]
              }
            }
          }
        },

        {
          $sort: {
            revenue: -1
          }
        },

        {
          $limit: 5
        }
      ]
    }
  }
])
```

Conceptually:

```text
                  Completed Orders
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓

     Order stats                   Top products
```

Output:

```js
{
  orderStats: [
    {
      _id: null,
      totalOrders: 500
    }
  ],

  topProducts: [
    {
      _id: "Laptop",
      revenue: 50000
    }
  ]
}
```

This is useful for:

```text
Dashboard APIs
Pagination + count
Analytics endpoints
Multiple metrics
```

---

# 15. Very Useful `$facet` Pattern — Pagination + Total Count

Suppose your API needs:

```json
{
  "data": [...],
  "total": 1000
}
```

You can do:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $facet: {
      data: [
        {
          $sort: {
            createdAt: -1
          }
        },
        {
          $skip: 20
        },
        {
          $limit: 10
        }
      ],

      total: [
        {
          $count: "count"
        }
      ]
    }
  }
])
```

Output:

```js
{
  data: [
    // 10 orders
  ],

  total: [
    {
      count: 1000
    }
  ]
}
```

This is a pattern worth remembering.

---

# 16. Date Aggregation

You will almost certainly encounter:

> Group sales by month.

Suppose:

```js
{
  createdAt: ISODate("2026-01-15"),
  amount: 500
}
```

You can group by year and month:

```js
{
  $group: {
    _id: {
      year: {
        $year: "$createdAt"
      },

      month: {
        $month: "$createdAt"
      }
    },

    revenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: {
    year: 2026,
    month: 1
  },

  revenue: 5000
}
```

---

## `$dateToString`

Often cleaner for output:

```js
{
  $group: {
    _id: {
      $dateToString: {
        format: "%Y-%m",
        date: "$createdAt"
      }
    },

    revenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: "2026-01",
  revenue: 5000
}
```

Then:

```js
{
  $sort: {
    _id: 1
  }
}
```

---

# 17. Full Coding-Round Style Example

Let's combine things.

Collections:

## `users`

```js
{
  _id: 101,
  name: "Denish",
  country: "India"
}
```

## `orders`

```js
{
  _id: 1,
  userId: 101,
  status: "completed",

  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 1
    }
  ]
}
```

Question:

> Find the top 5 users by total completed-order spending, including their names.

---

## Think first

### What documents?

```text
Completed orders

→ $match
```

### Calculate order/item revenue?

Items are arrays.

We could:

```text
$unwind
→ one document per item
```

### Combine spending per user?

```text
$group
```

### Get user information?

```text
$lookup
```

### User object is one result?

```text
$unwind
```

### Rank?

```text
$sort
→ $limit
```

---

## Pipeline

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },

  {
    $unwind: "$items"
  },

  {
    $group: {
      _id: "$userId",

      totalSpent: {
        $sum: {
          $multiply: [
            "$items.price",
            "$items.quantity"
          ]
        }
      }
    }
  },

  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user"
    }
  },

  {
    $unwind: "$user"
  },

  {
    $project: {
      _id: 0,

      userId: "$_id",
      name: "$user.name",
      totalSpent: 1
    }
  },

  {
    $sort: {
      totalSpent: -1
    }
  },

  {
    $limit: 5
  }
])
```

This looks long.

But it is just:

```text
Completed orders
        ↓
Individual items
        ↓
Revenue per user
        ↓
Join users
        ↓
Format result
        ↓
Top 5
```

---

# 18. Important: You Don't Always Need `$unwind`

This is something interviewers may test.

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

### Decision:

```text
Need to keep one document per order?

→ $map / $filter / $reduce

Need each item to participate as an independent document,
especially for grouping?

→ $unwind
```

---

# 19. Another Important Pattern — Filter an Array, Then Calculate

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

---

# 20. Conditional Aggregation Pattern

Question:

> For every user, return:

```text
totalOrders
completedOrders
pendingOrders
cancelledOrders
```

You don't need four separate queries.

```js
{
  $group: {
    _id: "$userId",

    totalOrders: {
      $sum: 1
    },

    completedOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "completed"]
          },
          1,
          0
        ]
      }
    },

    pendingOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "pending"]
          },
          1,
          0
        ]
      }
    },

    cancelledOrders: {
      $sum: {
        $cond: [
          {
            $eq: ["$status", "cancelled"]
          },
          1,
          0
        ]
      }
    }
  }
}
```

This pattern:

```text
$group
+
$sum
+
$cond
```

is worth remembering.

It is basically:

```js
if (status === "completed") {
  completed++;
}
```

inside aggregation.

---

# 21. The Major Distinctions You Need to Remember

This is probably the most important part of Batch 3.

## `$match` vs `$filter`

```text
$match

Filters documents.
```

```text
$filter

Filters elements inside an array.
```

---

## `$project` vs `$map`

```text
$project

Transforms a document.
```

```text
$map

Transforms every element inside an array.
```

---

## `$group` vs `$reduce`

```text
$group

Combines multiple pipeline documents.
```

```text
$reduce

Combines/reduces elements inside one array.
```

---

## `$map` vs `$unwind`

```text
$map

Keep array structure.
Transform elements.
```

```text
$unwind

Destroy/flatten array structure.
Each element becomes a pipeline document.
```

---

# 22. Batch 3 Cheat Sheet

```text
JOIN COLLECTION
→ $lookup

FILTER DOCUMENTS
→ $match

FILTER ARRAY ELEMENTS
→ $filter

TRANSFORM DOCUMENT
→ $project / $set

TRANSFORM ARRAY ELEMENTS
→ $map

FLATTEN ARRAY
→ $unwind

COMBINE DOCUMENTS
→ $group

REDUCE ONE ARRAY
→ $reduce

IF / ELSE
→ $cond

DEFAULT VALUE
→ $ifNull

ARRAY LENGTH
→ $size

GET ARRAY ELEMENT
→ $arrayElemAt

MULTIPLE RESULTS / STATS
→ $facet

GROUP BY DATE
→ $year / $month / $dateToString
```

---

# What I Actually Want You to Memorize

Not every syntax detail.

I want these **mental patterns**:

### Pattern A — Join

```text
Need another collection
→ $lookup

Need one joined object instead of an array
→ $unwind
```

### Pattern B — Array transformation

```text
Keep the array
→ $map / $filter
```

### Pattern C — Array analytics

```text
Need individual elements to participate
in grouping or pipeline stages

→ $unwind
```

### Pattern D — Array → single value

```text
items[]
↓
one calculated value

→ $reduce
```

### Pattern E — Conditional counts/sums

```text
$group
+
$sum
+
$cond
```

### Pattern F — Dashboard response

```text
Same filtered dataset
↓
Multiple calculations

→ $facet
```

---

## Next: Batch 4 — MongoDB Aggregation Coding Problems

This is where we stop learning new concepts for a bit and **actually train**.

We'll take around **15–20 coding-round-style problems**, progressively:

1. Easy → identify stages
2. Medium → write pipelines
3. Hard → nested arrays + grouping
4. `$lookup` problems
5. Conditional aggregation
6. Pagination + stats
7. Problems where there are **multiple valid solutions**, and we'll discuss which is better

For the next batch, I'll make you think first, then show the solution and the reasoning—because that's probably the fastest way to get you genuinely strong at aggregation rather than just recognizing operators.
