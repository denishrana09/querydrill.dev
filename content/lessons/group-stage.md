---
title: '$group: the heart of aggregation'
module: 'grouping'
track: 'aggregation'
description: 'MongoDB $group explained: _id is the grouping key, everything else is an accumulator. The stage most people stall on.'
operators: ['$group']
source: 'batch2.md:532-582'
---

This is where aggregation stops being "find with extra steps" and people usually stall. It is worth slowing down for one idea: in `$group`, `_id` is not an id. It is the thing you are grouping *by*.

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
