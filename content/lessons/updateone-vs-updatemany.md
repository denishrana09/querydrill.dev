---
title: 'updateOne vs updateMany'
module: 'updating-documents'
track: 'fundamentals'
description: 'updateOne vs updateMany in MongoDB: which documents each one touches, and why updateOne is the safer default.'
source: 'batch1.md:992-1009'
---

Obvious once stated, and still asked in interviews - usually to see whether you reach for the safe one by default.

```js
updateOne()
```

Updates at most one matching document.

```js
updateMany()
```

Updates every matching document.

## Try it

Six users are `pending` in the sample data:

```js
db.users.updateMany(
  { status: "pending" },
  {
    $set: { status: "active" }
  }
)
```

`modifiedCount: 6`. Change it to `updateOne` and the same filter gives you `1`.
