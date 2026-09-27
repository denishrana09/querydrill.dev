---
title: 'Logical operators and implicit AND'
module: 'query-operators'
track: 'fundamentals'
description: 'MongoDB $and, $or and $not, plus the implicit AND that makes an explicit $and unnecessary most of the time.'
topics: ['find', 'logical', '$and', '$gte', '$lt', '$or']
source: 'batch1.md:148-224'
---

Listing two fields in one filter is already an AND, so `$and` is rarely needed. `$or` is the one you actually have to write - and the one people get wrong when they need "this, and also either of those".

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

## `$or`

```js
db.users.find({
  $or: [
    { status: "active" },
    { role: "admin" }
  ]
})
```

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
