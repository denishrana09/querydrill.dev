---
title: 'MongoDB find()'
topic: 'find'
description: 'MongoDB find() takes a filter and a projection: which documents, and which fields. Run one below, then practise the operators that go inside it.'
lede: 'Two arguments, and almost everything you will ever ask a collection fits in them.'
---

`find()` takes a filter and a projection. The filter decides which documents come back; the projection decides which fields of them do. Everything else — comparison operators, arrays, nested fields, sorting — is something that goes *inside* one of those two.

```js
db.users.find(
  { status: "active", age: { $gte: 21 } },
  { _id: 0, name: 1, age: 1, country: 1 }
).limit(5)
```

**Several keys in the filter mean AND.** There is no `$and` in the query above, and it does not need one — listing two conditions requires both. You only reach for `$and` explicitly when two conditions apply to the same field and would otherwise collide in the object.

**The projection is all-in or all-out, and `_id` is the exception.** List fields with `1` to keep only those; list them with `0` to drop those and keep the rest. Mixing the two in one projection is an error — except for `_id`, which is included by default and can be switched off alongside either style. That is why `_id: 0` appears in so many examples.

**`find()` returns a cursor, not an array.** `.sort()`, `.limit()` and `.skip()` are methods on that cursor, and the server applies them in that order regardless of the order you chain them — so `.limit(5).sort({ age: -1 })` sorts everything and then takes five, not the reverse.

**`findOne()` returns a document or `null`.** Not an array of one. That difference propagates: code that works on a `find()` result and then quietly breaks on `findOne()` is usually iterating something that is no longer iterable.

What `find()` cannot do is group, join or compute new fields. That is where the aggregation pipeline starts, and the first lesson of that track is about exactly where the line falls.
