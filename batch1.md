# Batch 1 — MongoDB Fundamentals + Querying

We'll move fast through this. The goal is **not to memorize MongoDB syntax**, but to rebuild the mental model you need before aggregation.

---

# 1. The MongoDB Mental Model

MongoDB stores data as **documents** inside **collections**.

```js
// users collection

{
  _id: ObjectId("..."),
  name: "Denish",
  email: "denish@example.com",
  age: 28,
  skills: ["Node.js", "MongoDB", "Kafka"],
  address: {
    city: "Surat",
    country: "India"
  }
}
```

Think roughly:

```text
MongoDB              SQL
--------------------------------
Database             Database
Collection           Table
Document             Row
Field                Column
Embedded document    JSON/Object
Array                Usually separate table / JSON
```

But **don't think MongoDB is just "SQL but JSON"**.

The biggest difference is usually:

> In MongoDB, you design documents based heavily on how your application reads and writes data.

We'll go deep into that in schema design.

---

# 2. Basic Queries — Rebuild the Syntax

## Find everything

```js
db.users.find()
```

## Find one

```js
db.users.findOne({
  email: "denish@example.com"
})
```

## Equality

```js
db.users.find({
  status: "active"
})
```

Equivalent SQL:

```sql
SELECT * FROM users
WHERE status = 'active';
```

---

# 3. Comparison Operators

You need these without thinking.

```js
$gt   // greater than
$gte  // greater than or equal
$lt
$lte
$ne
$in
$nin
```

Example:

```js
db.users.find({
  age: {
    $gte: 25,
    $lt: 40
  }
})
```

Meaning:

```text
25 <= age < 40
```

---

## `$in`

```js
db.users.find({
  status: {
    $in: ["active", "pending"]
  }
})
```

SQL-ish:

```sql
WHERE status IN ('active', 'pending')
```

---

## `$nin`

```js
db.users.find({
  status: {
    $nin: ["blocked", "deleted"]
  }
})
```

Be a little careful with `$nin` from a performance perspective, especially if the query matches a large portion of the collection.

---

# 4. Logical Operators

## `$and`

Usually implicit.

```js
db.users.find({
  age: { $gte: 25 },
  status: "active"
})
```

Means:

```text
age >= 25
AND
status = active
```

Explicit:

```js
db.users.find({
  $and: [
    { age: { $gte: 25 } },
    { status: "active" }
  ]
})
```

Usually you don't need `$and`.

---

## `$or`

```js
db.users.find({
  $or: [
    { status: "active" },
    { role: "admin" }
  ]
})
```

---

## Important interview-style example

```js
db.users.find({
  status: "active",
  $or: [
    { age: { $lt: 25 } },
    { role: "admin" }
  ]
})
```

Meaning:

```text
status = active

AND

(
  age < 25
  OR
  role = admin
)
```

---

# 5. Nested Objects

Given:

```js
{
  name: "Denish",

  address: {
    city: "Surat",
    country: "India"
  }
}
```

Query:

```js
db.users.find({
  "address.city": "Surat"
})
```

The important concept is **dot notation**.

You will use it constantly.

---

# 6. Arrays — Very Important

Suppose:

```js
{
  name: "Denish",
  skills: ["Node.js", "MongoDB", "Kafka"]
}
```

Find people with MongoDB:

```js
db.users.find({
  skills: "MongoDB"
})
```

MongoDB automatically matches an element inside the array.

You don't need:

```js
{
  skills: {
    $contains: "MongoDB"
  }
}
```

That doesn't exist.

---

## Find documents containing any of these

```js
db.users.find({
  skills: {
    $in: ["MongoDB", "Redis"]
  }
})
```

Meaning:

> User has MongoDB **OR** Redis.

---

## Find documents containing all of these

```js
db.users.find({
  skills: {
    $all: ["MongoDB", "Kafka"]
  }
})
```

Meaning:

> User must have both.

---

# 7. Arrays of Objects — Extremely Important

Example:

```js
{
  name: "Denish",

  orders: [
    {
      product: "Laptop",
      price: 1000,
      status: "completed"
    },
    {
      product: "Mouse",
      price: 50,
      status: "pending"
    }
  ]
}
```

## Basic matching

```js
db.users.find({
  "orders.product": "Laptop"
})
```

Finds the document if **any order** has product `Laptop`.

---

# ⚠️ Classic MongoDB Trap: Multiple Conditions on Array Objects

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

---

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

---

# 8. Projection

Suppose the document contains:

```js
{
  _id: 1,
  name: "Denish",
  email: "denish@example.com",
  passwordHash: "secret",
  address: {...}
}
```

You probably don't want everything.

```js
db.users.find(
  {
    status: "active"
  },
  {
    name: 1,
    email: 1
  }
)
```

Result:

```js
{
  _id: 1,
  name: "Denish",
  email: "denish@example.com"
}
```

`_id` is included by default.

Exclude it:

```js
db.users.find(
  {},
  {
    _id: 0,
    name: 1,
    email: 1
  }
)
```

---

## Exclusion projection

```js
db.users.find(
  {},
  {
    passwordHash: 0,
    internalNotes: 0
  }
)
```

Generally, you **don't mix inclusion and exclusion** in the same projection, except `_id`.

---

# 9. Sorting

```js
db.users.find().sort({
  age: -1
})
```

```text
1   ascending
-1  descending
```

Multiple fields:

```js
db.users.find().sort({
  age: -1,
  name: 1
})
```

Meaning:

```text
Sort by age descending

If same age:
  sort by name ascending
```

---

# 10. Limit and Skip

```js
db.users
  .find()
  .sort({ createdAt: -1 })
  .skip(20)
  .limit(10)
```

Classic pagination:

```text
page = 3
limit = 10

skip = (page - 1) * limit
     = 20
```

---

## ⚠️ Senior-level note: Large `skip()` is problematic

Imagine:

```js
.skip(1000000)
```

MongoDB still has to walk past a large number of results.

For large datasets, prefer **cursor/range-based pagination**.

Example:

```js
db.users.find({
  createdAt: {
    $lt: lastSeenCreatedAt
  }
})
.sort({
  createdAt: -1
})
.limit(20)
```

In real applications, you often also use `_id` as a tie-breaker.

Example conceptually:

```text
createdAt DESC
_id DESC
```

We'll revisit this during indexing.

---

# 11. Updates

Now the important operators.

Suppose:

```js
{
  _id: 1,
  name: "Denish",
  age: 28,
  skills: ["Node.js"]
}
```

---

## `$set`

```js
db.users.updateOne(
  { _id: 1 },
  {
    $set: {
      age: 29
    }
  }
)
```

---

## ⚠️ Dangerous mistake

Suppose:

```js
address: {
  city: "Surat",
  country: "India"
}
```

You do:

```js
$set: {
  address: {
    city: "Bangalore"
  }
}
```

Result:

```js
address: {
  city: "Bangalore"
}
```

You replaced the entire object.

If you want only the city:

```js
$set: {
  "address.city": "Bangalore"
}
```

Result:

```js
address: {
  city: "Bangalore",
  country: "India"
}
```

Again: **dot notation matters**.

---

# 12. `$inc`

Very useful for atomic counters.

```js
db.posts.updateOne(
  { _id: postId },
  {
    $inc: {
      likes: 1
    }
  }
)
```

You do **not** need:

```js
const post = await findPost();

await updatePost({
  likes: post.likes + 1
});
```

That can create race conditions.

Instead:

```js
$inc
```

is atomic at the document level.

---

# 13. Array Updates

Given:

```js
{
  _id: 1,
  skills: ["Node.js"]
}
```

## Add

```js
$push: {
  skills: "MongoDB"
}
```

Result:

```js
["Node.js", "MongoDB"]
```

---

## Prevent duplicates

```js
$addToSet: {
  skills: "MongoDB"
}
```

If MongoDB already exists:

```text
Nothing happens.
```

This distinction is important:

```text
$push       → always adds

$addToSet   → adds only if not already present
```

---

## Remove from array

```js
$pull: {
  skills: "MongoDB"
}
```

---

# 14. Updating an Object Inside an Array

Given:

```js
{
  _id: 1,

  orders: [
    {
      _id: 101,
      product: "Laptop",
      status: "pending"
    },
    {
      _id: 102,
      product: "Mouse",
      status: "pending"
    }
  ]
}
```

Update order `101`:

```js
db.users.updateOne(
  {
    _id: 1,
    "orders._id": 101
  },
  {
    $set: {
      "orders.$.status": "completed"
    }
  }
)
```

The `$` here refers to the **matched array element**.

This is useful to remember.

There are also:

```text
$        → first matching element

$[]      → all elements

$[x]     → filtered elements
```

Example:

```js
db.users.updateOne(
  { _id: 1 },
  {
    $set: {
      "orders.$[].status": "archived"
    }
  }
)
```

Updates all array elements.

---

# 15. `find()` vs `aggregate()`

Very important before we enter aggregation.

Use `find()` when you're basically:

```text
Filter documents
Sort
Project fields
Paginate
```

Example:

```js
db.users.find(
  {
    status: "active",
    age: { $gte: 25 }
  },
  {
    name: 1,
    email: 1
  }
)
.sort({
  createdAt: -1
})
.limit(10)
```

Use `aggregate()` when you're doing:

```text
Grouping
Calculations
Transformations
Joining collections
Complex array manipulation
Analytics/reporting
Multi-stage processing
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
    $group: {
      _id: "$userId",
      totalSpent: {
        $sum: "$amount"
      }
    }
  }
])
```

Don't worry about understanding every part yet.

Just notice:

```text
find()

Document → Filter → Return documents
```

vs:

```text
aggregate()

Documents
   ↓
Stage 1
   ↓
Stage 2
   ↓
Stage 3
   ↓
Transformed result
```

Aggregation is a **pipeline**.

---

# 16. Atomicity — Very Important Interview Concept

MongoDB guarantees that a **single-document write operation is atomic**.

Example:

```js
db.accounts.updateOne(
  {
    _id: accountId,
    balance: {
      $gte: 100
    }
  },
  {
    $inc: {
      balance: -100
    }
  }
)
```

This is powerful.

Imagine two requests try to withdraw money simultaneously.

Instead of:

```text
1. Read balance
2. Check balance
3. Update balance
```

You combine the condition and update:

```text
balance >= 100
        +
decrement balance by 100
```

in one atomic operation.

This pattern will be useful later when we discuss concurrency and transactions.

---

# 17. `updateOne` vs `updateMany`

Pretty obvious, but interviewers sometimes ask.

```js
updateOne()
```

Updates at most one matching document.

```js
updateMany()
```

Updates every matching document.

---

# 18. `replaceOne()` vs `$set`

This can catch people.

Given:

```js
{
  _id: 1,
  name: "Denish",
  age: 28,
  role: "admin"
}
```

Using:

```js
db.users.replaceOne(
  { _id: 1 },
  {
    name: "New Name"
  }
)
```

The document becomes essentially:

```js
{
  _id: 1,
  name: "New Name"
}
```

You replaced the document.

Whereas:

```js
db.users.updateOne(
  { _id: 1 },
  {
    $set: {
      name: "New Name"
    }
  }
)
```

keeps everything else.

---

# 19. Upsert

```js
db.users.updateOne(
  {
    email: "denish@example.com"
  },
  {
    $set: {
      name: "Denish"
    }
  },
  {
    upsert: true
  }
)
```

Meaning:

```text
If document exists
    → update it

If it doesn't exist
    → insert it
```

Useful in:

* synchronization jobs
* migrations
* external integrations
* idempotent operations

---

# 20. The Most Important Things to Remember From Batch 1

If you forget everything else, remember these.

### Arrays

```text
Array contains value
→ { skills: "MongoDB" }

Any match
→ $in

All values required
→ $all

Multiple conditions on SAME array object
→ $elemMatch
```

### Nested objects

```text
"address.city": "Surat"
```

### Updates

```text
$set        Set field
$inc        Increment/decrement
$push       Add to array
$addToSet   Add without duplicates
$pull       Remove from array
```

### Important distinction

```text
$set: { address: {...} }

can replace the entire nested object
```

vs:

```text
$set: {
  "address.city": "Bangalore"
}
```

updates only that field.

### Pagination

```text
Small/simple pagination
→ skip + limit

Large datasets
→ cursor/range-based pagination
```

### Atomicity

```text
Single-document operations are atomic.
```

### `find()` vs `aggregate()`

```text
find()
→ retrieve/filter documents

aggregate()
→ transform/process documents through stages
```

---

# Mini Interview Questions — Answer These Mentally

### 1. What is wrong with this query?

```js
db.users.find({
  "orders.product": "Laptop",
  "orders.status": "completed"
})
```

**Answer:** The conditions can match different elements of the `orders` array.

Correct:

```js
{
  orders: {
    $elemMatch: {
      product: "Laptop",
      status: "completed"
    }
  }
}
```

---

### 2. `$push` vs `$addToSet`?

```text
$push
→ always adds

$addToSet
→ prevents duplicate values
```

---

### 3. Why is this dangerous?

```js
$set: {
  profile: {
    name: "Denish"
  }
}
```

Because it can replace the entire `profile` object.

---

### 4. How would you prevent a race condition while decrementing stock?

```js
db.products.updateOne(
  {
    _id: productId,
    stock: { $gte: quantity }
  },
  {
    $inc: {
      stock: -quantity
    }
  }
)
```

The condition and update happen atomically for that document.

---

### 5. When should you use `$elemMatch`?

When multiple conditions must match the **same object inside an array**.

---

## Batch 1 takeaway

You don't need to become a CRUD syntax machine. You just need this foundation to be automatic, because in the next batch we'll start building aggregation pipelines on top of it.

**Next: Batch 2 — Aggregation Foundation.** This is where we'll slow down and build your aggregation intuition properly:

```text
$match
↓
$project
↓
$group
↓
$sort
↓
$limit / $skip
↓
$unwind
```

And we'll use one consistent dataset throughout, so you're not constantly trying to understand new schemas while learning the pipeline.
