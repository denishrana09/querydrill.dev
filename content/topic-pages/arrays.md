---
title: 'MongoDB array queries'
topic: 'arrays'
description: 'How MongoDB queries arrays: a field matches if any element matches, why two conditions can match different elements, and what $elemMatch fixes.'
lede: 'Querying an array field looks exactly like querying a scalar one, and that is precisely what makes it confusing.'
---

MongoDB does not make you say that a field is an array. `{ skills: "Kafka" }` matches a document whose `skills` is the string `"Kafka"`, and it also matches one whose `skills` is `["Node.js", "Kafka"]`. The same query, two different shapes of data, both match.

```js
db.users.find(
  { skills: "Kafka" },
  { _id: 1, name: 1, skills: 1 }
).limit(5)
```

The rule underneath is worth saying out loud: **an array field matches if *any* element matches.** Once you have that, most array behaviour follows.

**Two conditions can be satisfied by two different elements.** This is the trap, and it is not obvious. A filter on an array of objects — say `{ "orders.status": "pending", "orders.price": 1000 }` — does *not* mean "an order that is both pending and 1000". It means "some order is pending, and some order costs 1000", and those are allowed to be different orders. `$elemMatch` is what forces both conditions onto one element.

**`$all` is not `$in`.** `$in` asks whether any element is in your list; `$all` asks whether every value in your list is present. They read almost identically and answer opposite questions.

**Dot notation reaches inside elements without indexing.** `"items.product"` means "the `product` field of any element of `items`". A number in that path — `"items.0.product"` — means the first element specifically, which is a different and much rarer thing to want.

Updating arrays has its own rules — the positional `$`, `$push` against `$addToSet`, `$pull` — and the module below covers them. So does processing arrays inside a pipeline with `$map`, `$filter` and `$reduce`, which avoids `$unwind` entirely.
