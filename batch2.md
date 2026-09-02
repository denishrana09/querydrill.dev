# Batch 2 — MongoDB Aggregation Foundation

This is the important one.

Your goal is **not** to memorize aggregation syntax. By the end of this batch, I want you to look at a problem and naturally break it into stages.

The core mental model is:

```text
Documents
   ↓
$match       → Which documents do I need?
   ↓
$project     → Which fields / shape do I need?
   ↓
$unwind      → Do I need one array element per document?
   ↓
$group       → Do I need to combine documents?
   ↓
$sort
   ↓
$limit
   ↓
Final result
```

Not every pipeline needs every stage.

---

# 1. The Dataset We'll Use

Let's keep one realistic dataset throughout.

## `orders`

```js
{
  _id: 1,
  userId: 101,
  status: "completed",
  createdAt: ISODate("2026-01-10"),

  items: [
    {
      product: "Laptop",
      category: "Electronics",
      price: 1000,
      quantity: 1
    },
    {
      product: "Mouse",
      category: "Electronics",
      price: 50,
      quantity: 2
    }
  ]
}
```

```js
{
  _id: 2,
  userId: 101,
  status: "completed",
  createdAt: ISODate("2026-01-15"),

  items: [
    {
      product: "Keyboard",
      category: "Electronics",
      price: 100,
      quantity: 1
    }
  ]
}
```

```js
{
  _id: 3,
  userId: 102,
  status: "completed",
  createdAt: ISODate("2026-02-01"),

  items: [
    {
      product: "Laptop",
      category: "Electronics",
      price: 1000,
      quantity: 1
    }
  ]
}
```

```js
{
  _id: 4,
  userId: 103,
  status: "pending",

  items: [
    {
      product: "Mouse",
      category: "Electronics",
      price: 50,
      quantity: 1
    }
  ]
}
```

---

# 2. What Actually Is an Aggregation Pipeline?

You pass documents through a series of transformations.

```js
db.orders.aggregate([
  { /* stage 1 */ },
  { /* stage 2 */ },
  { /* stage 3 */ }
])
```

Think like Node.js:

```js
const result = orders
  .filter(...)
  .map(...)
  .sort(...)
```

Aggregation is conceptually similar:

```text
$match    ≈ filter()
$project  ≈ map()
$sort     ≈ sort()
$group    ≈ groupBy + reduce()
```

That analogy is not perfect, but it is useful.

---

# 3. `$match` — Filter Documents

This is basically:

```js
find()
```

but inside an aggregation pipeline.

### Example

Find completed orders:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  }
])
```

Input:

```text
Order 1 → completed
Order 2 → completed
Order 3 → completed
Order 4 → pending
```

Output:

```text
Order 1
Order 2
Order 3
```

---

## Multiple conditions

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed",
      userId: 101
    }
  }
])
```

Exactly the same query operators work:

```js
{
  $match: {
    createdAt: {
      $gte: ISODate("2026-01-01"),
      $lt: ISODate("2026-02-01")
    }
  }
}
```

---

# Important Performance Rule

Usually:

> **Filter as early as possible.**

Bad conceptual pipeline:

```text
100 million documents
        ↓
$group
        ↓
$match
```

Better:

```text
100 million
   ↓
$match → 10,000
   ↓
$group
```

Why?

Because later stages process fewer documents.

This will become very important later when we discuss indexes and aggregation optimization.

---

# 4. `$project` — Shape the Document

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

---

# 5. `$project` Can Also Create Fields

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

---

# 6. `$set` / `$addFields`

These add fields while keeping the existing fields.

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

---

# 7. `$sort`

Same basic idea as normal MongoDB sorting.

```js
{
  $sort: {
    createdAt: -1
  }
}
```

Multiple fields:

```js
{
  $sort: {
    userId: 1,
    createdAt: -1
  }
}
```

---

# 8. `$limit` and `$skip`

```js
{
  $limit: 10
}
```

```js
{
  $skip: 20
}
```

Example:

```js
db.orders.aggregate([
  {
    $match: {
      status: "completed"
    }
  },
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
])
```

---

# ⚠️ Order Matters

This:

```text
$sort
↓
$limit
```

means:

> Find the top 10 after sorting.

But:

```text
$limit
↓
$sort
```

means:

> Take the first 10 arbitrary/current-order documents, then sort only those 10.

Aggregation is a pipeline.

**Every stage receives the output of the previous stage.**

This sounds obvious, but it is one of the biggest sources of mistakes.

---

# 9. `$group` — The Heart of Aggregation

This is where people usually start panicking.

Don't.

Think:

> **Take multiple documents and combine them into groups.**

Suppose we have:

```text
Order 1 → userId 101
Order 2 → userId 101
Order 3 → userId 102
```

Now:

```js
{
  $group: {
    _id: "$userId"
  }
}
```

Result:

```js
[
  { _id: 101 },
  { _id: 102 }
]
```

MongoDB says:

```text
All documents where userId = 101
        ↓
Put them in group 101

All documents where userId = 102
        ↓
Put them in group 102
```

---

# 10. `$group` + `$sum`

Now let's count orders per user.

```js
{
  $group: {
    _id: "$userId",

    orderCount: {
      $sum: 1
    }
  }
}
```

Result:

```js
[
  {
    _id: 101,
    orderCount: 2
  },
  {
    _id: 102,
    orderCount: 1
  }
]
```

Mental translation:

```text
Group by userId

For every document:
  add 1
```

This is very similar to:

```sql
GROUP BY userId
COUNT(*)
```

---

## Sum a field

Suppose documents:

```js
{
  userId: 101,
  amount: 500
}
```

```js
{
  userId: 101,
  amount: 300
}
```

Pipeline:

```js
{
  $group: {
    _id: "$userId",

    totalSpent: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: 101,
  totalSpent: 800
}
```

---

# 11. The Main `$group` Accumulators

For now, remember these:

```text
$sum
$avg
$min
$max
$push
$addToSet
$first
$last
```

Example:

```js
{
  $group: {
    _id: "$userId",

    total: {
      $sum: "$amount"
    },

    average: {
      $avg: "$amount"
    },

    biggestOrder: {
      $max: "$amount"
    },

    smallestOrder: {
      $min: "$amount"
    }
  }
}
```

---

# 12. `$push` vs `$addToSet` Inside `$group`

Very similar to what you saw in updates.

Suppose:

```text
User 101 bought:

Laptop
Mouse
Laptop
```

### `$push`

```js
products: {
  $push: "$product"
}
```

Result:

```js
[
  "Laptop",
  "Mouse",
  "Laptop"
]
```

### `$addToSet`

```js
products: {
  $addToSet: "$product"
}
```

Result:

```js
[
  "Laptop",
  "Mouse"
]
```

Remember:

```text
$push
→ keep duplicates

$addToSet
→ unique values
```

---

# 13. The Big Problem: Arrays

Now we return to our original `orders` collection.

```js
{
  _id: 1,

  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 1
    },
    {
      product: "Mouse",
      price: 50,
      quantity: 2
    }
  ]
}
```

Suppose the question is:

> Find the total quantity sold for each product.

Your first instinct might be:

```js
{
  $group: {
    _id: "$items.product",
    totalQuantity: {
      $sum: "$items.quantity"
    }
  }
}
```

But `items` is an **array**.

You don't yet have:

```text
One document = one product
```

You have:

```text
One document = one order
```

We need to change the shape.

This is where `$unwind` comes in.

---

# 14. `$unwind` — One Document Per Array Element

Input:

```js
{
  _id: 1,

  userId: 101,

  items: [
    {
      product: "Laptop",
      price: 1000,
      quantity: 1
    },
    {
      product: "Mouse",
      price: 50,
      quantity: 2
    }
  ]
}
```

Pipeline:

```js
{
  $unwind: "$items"
}
```

Output:

```js
{
  _id: 1,
  userId: 101,

  items: {
    product: "Laptop",
    price: 1000,
    quantity: 1
  }
}
```

AND:

```js
{
  _id: 1,
  userId: 101,

  items: {
    product: "Mouse",
    price: 50,
    quantity: 2
  }
}
```

One document became **two documents**.

This is the key idea:

```text
Before $unwind

Order
 ├── Laptop
 └── Mouse


After $unwind

Order + Laptop

Order + Mouse
```

---

# 15. `$unwind` + `$group`

Now we can solve:

> Total quantity sold per product.

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
      _id: "$items.product",

      totalQuantity: {
        $sum: "$items.quantity"
      }
    }
  }
])
```

Let's walk through it.

---

## Stage 1 — `$match`

```text
Only completed orders

Order 1
Order 2
Order 3
```

---

## Stage 2 — `$unwind`

```text
Order 1 → Laptop
Order 1 → Mouse
Order 2 → Keyboard
Order 3 → Laptop
```

Now the data looks conceptually like:

```text
Laptop
Mouse
Keyboard
Laptop
```

---

## Stage 3 — `$group`

```text
Laptop
  quantity: 1 + 1 = 2

Mouse
  quantity: 2

Keyboard
  quantity: 1
```

Result:

```js
[
  {
    _id: "Laptop",
    totalQuantity: 2
  },
  {
    _id: "Mouse",
    totalQuantity: 2
  },
  {
    _id: "Keyboard",
    totalQuantity: 1
  }
]
```

---

# 🚨 This Pattern Is Extremely Important

Memorize the **concept**, not the code:

```text
Array of things

Need to analyze each thing individually?

        ↓

$unwind

        ↓

Now each array item behaves like
an individual pipeline document

        ↓

$group / $match / calculations
```

Examples:

```text
Order
 └── items[]
```

```text
User
 └── skills[]
```

```text
Post
 └── comments[]
```

```text
Invoice
 └── lineItems[]
```

Whenever the question is about **individual elements inside an array**, `$unwind` should enter your mind.

---

# 16. Calculating Revenue Per Product

Question:

> Find total revenue generated by each product.

Our data:

```text
Laptop
price: 1000
quantity: 1

Mouse
price: 50
quantity: 2
```

Revenue:

```text
price × quantity
```

Pipeline:

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
  }
])
```

Result:

```text
Laptop → 2000
Mouse → 100
Keyboard → 100
```

Notice something important:

You don't always need:

```text
$set
↓
$group
```

You could do:

```js
$sum: {
  $multiply: [...]
}
```

directly inside `$group`.

But sometimes using `$set` makes a complicated pipeline easier to understand.

---

# 17. `$group` Can Group by Multiple Fields

Suppose:

> Find quantity sold per user per product.

You can group by an object.

```js
{
  $group: {
    _id: {
      userId: "$userId",
      product: "$items.product"
    },

    quantity: {
      $sum: "$items.quantity"
    }
  }
}
```

Result:

```js
{
  _id: {
    userId: 101,
    product: "Laptop"
  },

  quantity: 1
}
```

This is equivalent conceptually to:

```sql
GROUP BY userId, product
```

---

# 18. The `$group` `_id` Is Just the Grouping Key

This confuses many people initially.

Here:

```js
{
  $group: {
    _id: "$userId"
  }
}
```

`_id` does **not** mean the original document ID.

Inside `$group`:

> `_id` means "what am I grouping by?"

Examples:

```js
_id: "$userId"
```

Group by user.

```js
_id: "$items.product"
```

Group by product.

```js
_id: null
```

Everything goes into **one group**.

Example:

```js
{
  $group: {
    _id: null,

    totalRevenue: {
      $sum: "$amount"
    }
  }
}
```

Result:

```js
{
  _id: null,
  totalRevenue: 50000
}
```

Meaning:

> Calculate one total across all documents.

This is a common interview pattern.

---

# 19. `$first` and `$last`

These depend on the order of documents entering `$group`.

Suppose:

```js
{
  $sort: {
    createdAt: -1
  }
}
```

Then:

```js
{
  $group: {
    _id: "$userId",

    latestOrder: {
      $first: "$_id"
    }
  }
}
```

Because we sorted newest first:

```text
$first = newest order
```

If sorted ascending:

```text
$first = oldest order
```

### Important interview rule

> `$first` and `$last` only make sense when you understand the order of documents entering the `$group`.

---

# 20. A Full Example

Question:

> Find the top 3 products by revenue from completed orders.

Let's think first.

### Step 1

Which orders?

```text
Completed
```

↓

```js
$match
```

### Step 2

Revenue is per item, but items are inside an array.

```text
items[]
```

↓

```js
$unwind
```

### Step 3

Group by product.

```text
Laptop
Mouse
Keyboard
```

↓

```js
$group
```

### Step 4

Calculate:

```text
price × quantity
```

↓

```js
$sum + $multiply
```

### Step 5

Sort by revenue.

↓

```js
$sort
```

### Step 6

Take top 3.

↓

```js
$limit
```

Final:

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
    $limit: 3
  }
])
```

This is exactly how I want you to approach coding-round questions.

**Don't start typing immediately.**

First:

```text
What is my input?
        ↓
What shape do I need?
        ↓
What transformations are required?
        ↓
Which stage performs each transformation?
```

---

# 21. The Most Useful Aggregation Thinking Framework

For almost every question, ask these in order:

## Question 1: Which documents do I need?

```text
$match
```

Example:

> Only completed orders from 2026.

---

## Question 2: Is the data I need inside an array?

```text
$unwind
```

Example:

> Analyze products inside `items`.

---

## Question 3: Do I need to combine multiple documents?

```text
$group
```

Example:

> Revenue per product.

---

## Question 4: Do I need calculated fields?

```text
$project
or
$set
or expressions inside $group
```

Example:

```text
price × quantity
```

---

## Question 5: How should the result look?

```text
$project
```

Example:

Instead of:

```js
{
  _id: "Laptop",
  revenue: 2000
}
```

You might want:

```js
{
  product: "Laptop",
  revenue: 2000
}
```

---

## Question 6: Do I need ranking/pagination?

```text
$sort
$skip
$limit
```

---

# 22. Common Beginner Mistakes

## Mistake 1: Forgetting `$unwind`

Question:

> Revenue per product.

Data:

```text
orders
  → items[]
```

You try grouping directly.

Ask:

> Am I analyzing the order, or each item inside the order?

If each item:

```text
Probably $unwind.
```

---

## Mistake 2: `$group` too early

Imagine:

```text
Need:
completed orders
```

Bad:

```text
$group everything
↓
$match completed
```

Better:

```text
$match completed
↓
$group
```

Reduce data early.

---

## Mistake 3: Forgetting that `$group` changes the shape

Before:

```js
{
  _id: 1,
  userId: 101,
  status: "completed"
}
```

After:

```js
{
  $group: {
    _id: "$userId",
    count: { $sum: 1 }
  }
}
```

You now have:

```js
{
  _id: 101,
  count: 5
}
```

You no longer automatically have:

```text
status
createdAt
items
```

Unless you explicitly preserve/accumulate them.

---

## Mistake 4: Confusing `$project` and `$group`

```text
$project

Transforms each document individually.

Document A → transformed A
Document B → transformed B
```

Whereas:

```text
$group

Combines multiple documents.

A + B + C
      ↓
Grouped result
```

This distinction is fundamental.

---

# 23. Rapid Pattern Recognition

I want you to start recognizing these immediately.

| Problem                          | Think                        |
| -------------------------------- | ---------------------------- |
| Filter documents                 | `$match`                     |
| Keep/rename/calculate fields     | `$project`                   |
| Add a calculated field           | `$set`                       |
| Analyze elements inside an array | `$unwind`                    |
| Count/sum/average by something   | `$group`                     |
| Order results                    | `$sort`                      |
| Top N                            | `$sort` → `$limit`           |
| Pagination                       | `$sort` → `$skip` → `$limit` |
| One overall total                | `$group: { _id: null }`      |

---

# The 5 Patterns I Want You to Actually Remember

## Pattern 1 — Count by X

```js
[
  {
    $group: {
      _id: "$someField",
      count: { $sum: 1 }
    }
  }
]
```

---

## Pattern 2 — Sum by X

```js
[
  {
    $group: {
      _id: "$someField",
      total: {
        $sum: "$amount"
      }
    }
  }
]
```

---

## Pattern 3 — Array analytics

```js
[
  {
    $unwind: "$items"
  },

  {
    $group: {
      _id: "$items.product",
      count: { $sum: 1 }
    }
  }
]
```

---

## Pattern 4 — Top N

```js
[
  {
    $group: {
      _id: "$category",
      total: {
        $sum: "$amount"
      }
    }
  },

  {
    $sort: {
      total: -1
    }
  },

  {
    $limit: 5
  }
]
```

---

## Pattern 5 — Filter → Transform → Group → Sort

This is probably the most common pattern:

```text
$match
   ↓
$unwind / $project / $set
   ↓
$group
   ↓
$project
   ↓
$sort
   ↓
$limit
```

---

# Your Batch 2 Mental Cheat Sheet

```text
$match
"Which documents?"

$project
"What should each document look like?"

$set
"What field do I want to add/change?"

$unwind
"Do I need to turn array elements into individual documents?"

$group
"Do I need to combine documents?"

$sort
"In what order?"

$limit
"How many?"

$skip
"Which results should I skip?"
```

---

# Quick Self-Test

Don't worry about exact syntax yet. Just identify the pipeline stages.

### 1. Find the top 5 customers by total spending.

Think:

```text
completed orders?
→ $match

group by user
→ $group

sort by spending
→ $sort

top 5
→ $limit
```

---

### 2. Find total sales per product.

```text
Product is inside items[]
→ $unwind

group by product
→ $group
```

---

### 3. Find average order value per month.

```text
Maybe filter completed
→ $match

extract month
→ $project / $set

group by month
→ $group

average
→ $avg
```

We'll learn date operators in Batch 3.

---

### 4. Find the latest order for every user.

```text
Sort newest first
→ $sort

group by user
→ $group

take first
→ $first
```

This is a very common pattern.

---

## What matters most from Batch 2

If you remember only one thing:

> **Aggregation is just a sequence of data transformations.**

Don't look at this:

```js
db.orders.aggregate([
  { $match: ... },
  { $unwind: ... },
  { $group: ... },
  { $sort: ... }
])
```

as one scary MongoDB query.

Instead read it like:

```text
Take these orders.

↓ Filter them

Take their items.

↓ Split each item into its own document

Take those items.

↓ Group them by product and calculate revenue

Take those results.

↓ Sort them by revenue
```

Once you start mentally narrating the pipeline like that, aggregation gets much easier.

**Next, Batch 3 will go into the things that make aggregation coding rounds more interesting:** `$lookup`, array manipulation, `$map`, `$filter`, `$reduce`, `$cond`, date grouping, `$facet`, and more complex pipeline problems.
