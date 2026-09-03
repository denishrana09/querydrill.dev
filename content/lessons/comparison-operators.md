---
title: 'Comparison operators'
module: 'query-operators'
track: 'fundamentals'
description: 'MongoDB comparison operators: $gt, $gte, $lt, $lte, $ne and how to combine two of them on a single field.'
operators: ['$gte', '$lt']
source: 'batch1.md:83-115'
---

These are the operators you should be able to write without thinking. The one detail worth memorising: two conditions on the *same* field go inside the *same* object.

```js
$gt   // greater than
$gte  // greater than or equal
$lt
$lte
$ne
$in
$nin
```

Example:

```js
db.users.find({
  age: {
    $gte: 25,
    $lt: 40
  }
})
```

Meaning:

```text
25 <= age < 40
```
