---
title: 'What $lookup costs'
module: 'lookup-joins'
track: 'advanced-aggregation'
description: 'What $lookup actually costs in MongoDB, why it runs per document, and when embedding beats joining.'
operators: ['$lookup']
source: 'batch3.md:364-405'
---

Syntax is the easy half. The question that separates answers is what `$lookup` costs - it runs once per input document, which is why filtering before the join matters so much, and why embedding is often the better design.

Be able to say:

> `$lookup` can become expensive, especially with large collections or poor join-field indexing.

If you're doing:

```text
orders.userId
→
users._id
```

`users._id` is already indexed.

But for:

```text
orders.userId
→
users.externalUserId
```

you probably want an index on:

```js
{ externalUserId: 1 }
```

Also:

* Filter before `$lookup` when possible.
* Return only needed data.
* Avoid joining huge unnecessary datasets.
* Consider schema design: sometimes embedding is better than repeatedly joining.
* `$lookup` is not automatically "bad"; the access pattern and data volume matter.
