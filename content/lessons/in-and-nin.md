---
title: '$in and $nin'
module: 'query-operators'
track: 'fundamentals'
description: 'MongoDB $in and $nin: match a field against a list of acceptable values, and the trap $nin sets with missing fields.'
topics: ['find', '$in', '$nin']
source: 'batch1.md:116-147'
---

`$in` is "field equals any of these". `$nin` is its opposite, and it is less symmetric than it looks - a document missing the field entirely still matches `$nin`.

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

## `$nin`

```js
db.users.find({
  status: {
    $nin: ["blocked", "deleted"]
  }
})
```

Be a little careful with `$nin` from a performance perspective, especially if the query matches a large portion of the collection.
