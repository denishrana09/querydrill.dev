---
title: 'find() and findOne()'
module: 'documents-and-find'
track: 'fundamentals'
description: 'How to read documents out of a MongoDB collection with find() and findOne(), and how each one differs from a SQL SELECT.'
source: 'batch1.md:50-82'
---

`find()` returns a cursor over every matching document. `findOne()` returns a single document, or `null`. That is the whole difference, and it is the first thing you reach for in any query.

## Find everything

```js
db.users.find()
```

## Find one

```js
db.users.findOne({
  email: "denish101@example.com"
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
