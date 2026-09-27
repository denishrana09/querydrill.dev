---
title: 'Sorting results'
module: 'sorting-and-paging'
track: 'fundamentals'
description: 'Sort MongoDB results with sort({ field: 1 }) for ascending and -1 for descending, including multi-field sorts.'
topics: ['find', 'sort']
source: 'batch1.md:504-536'
---

`1` is ascending, `-1` is descending, and multiple keys are applied left to right. Worth knowing before you rely on it: MongoDB does not promise any particular order for documents whose sort keys are equal.

```js
db.users.find().sort({
  age: -1
})
```

```text
1   ascending
-1  descending
```

Multiple fields:

```js
db.users.find().sort({
  age: -1,
  name: 1
})
```

Meaning:

```text
Sort by age descending

If same age:
  sort by name ascending
```
