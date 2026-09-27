---
title: 'MongoDB updates'
topic: 'update'
description: 'MongoDB update operators: $set, $inc, $push and friends, why updateOne needs a filter that is precise, and how a missing $set replaces the document.'
lede: 'Every update is a filter plus an instruction — and leaving the instruction out is a destructive operation, not a syntax error.'
---

An update has two halves: which documents to change, and what to do to them. The second half is where MongoDB differs sharply from an `UPDATE … SET` you may be used to.

```js
db.users.updateOne(
  { _id: 101 },
  { $set: { "address.city": "Mumbai" } }
)
```

**Without an operator, you are replacing the document.** `{ $set: { status: "active" } }` changes one field and leaves the other twelve alone. `{ status: "active" }` — the same object without `$set` — replaces the entire document with `{ _id, status }`, and everything else is gone. Both are valid calls. Only one of them is usually meant.

**Dot notation edits inside an object; assigning the object replaces it.** `$set: { "address.city": "Mumbai" }` keeps `address.country`. `$set: { address: { city: "Mumbai" } }` deletes it. The distinction survives at every depth and is the single most common way nested data gets quietly lost.

**`$inc` is atomic; read-then-write is not.** Reading a stock count, subtracting one in your code and writing it back is a race that two requests will lose. `updateOne({ _id, stock: { $gte: 1 } }, { $inc: { stock: -1 } })` does the check and the change in one operation, and tells you via `matchedCount` whether it applied.

`updateOne` stops at the first match, so a filter that matches more documents than you think changes an arbitrary one of them. `updateMany` changes all of them. And `upsert: true` inserts when nothing matched, building the new document from the filter plus the update — which is why the filter's shape matters even when it matches nothing.

Arrays have their own operators and their own positional rules; that module is below.
