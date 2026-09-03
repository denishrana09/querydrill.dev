---
title: '$push, $addToSet and $pull'
module: 'updating-arrays'
track: 'fundamentals'
description: 'MongoDB array updates: $push to append, $addToSet to append only if absent, $pull to remove matching elements.'
operators: ['$addToSet', '$pull', '$push']
source: 'batch1.md:719-779'
---

Three operators cover most array writes, and the only one people confuse is `$push` versus `$addToSet`. Both append; only one checks whether the value is already there.

Given:

```js
{
  _id: 1,
  skills: ["Node.js"]
}
```

## Add

```js
$push: {
  skills: "MongoDB"
}
```

Result:

```js
["Node.js", "MongoDB"]
```

## Prevent duplicates

```js
$addToSet: {
  skills: "MongoDB"
}
```

If MongoDB already exists:

```text
Nothing happens.
```

This distinction is important:

```text
$push       → always adds

$addToSet   → adds only if not already present
```

## Remove from array

```js
$pull: {
  skills: "MongoDB"
}
```
