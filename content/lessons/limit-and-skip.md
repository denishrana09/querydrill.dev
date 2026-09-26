---
title: 'limit(), skip(), and why big skips hurt'
module: 'sorting-and-paging'
track: 'fundamentals'
description: 'Paginate MongoDB results with limit() and skip(), and why skip() gets slower the deeper into the results you go.'
operators: ['$lt']
source: 'batch1.md:537-597'
---

`limit()` and `skip()` are how everyone first implements pagination, and they work fine until they do not. The interesting part of this lesson is the second half: why page 10,000 costs so much more than page 2.

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

## ⚠️ Senior-level note: Large `skip()` is problematic

Imagine:

```js
.skip(1000000)
```

MongoDB still has to walk past a large number of results.

For large datasets, prefer **cursor/range-based pagination**.

Example:

```js no-run
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

The way out is to stop counting past documents at all: remember the last value you saw and ask for the next batch with a range condition on an indexed field. That is usually called keyset, or cursor, pagination.
