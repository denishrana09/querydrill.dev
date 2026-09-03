---
title: '$size and $arrayElemAt'
module: 'expression-operators'
track: 'advanced-aggregation'
description: 'MongoDB $size counts array elements and $arrayElemAt picks one out by index, including negative indexes from the end.'
operators: ['$arrayElemAt', '$project', '$size']
source: 'batch3.md:991-1070'
---

Two small operators that show up constantly: `$size` for how many elements an array has, `$arrayElemAt` for pulling one out by position. `$arrayElemAt` is what turns a one-element `$facet` or `$lookup` result into a plain value.

Suppose:

```js
{
  skills: [
    "Node.js",
    "MongoDB",
    "Kafka"
  ]
}
```

```js
{
  $project: {
    skillCount: {
      $size: "$skills"
    }
  }
}
```

Result:

```js
{
  skillCount: 3
}
```

Conceptually:

```js
skills.length
```

## `$arrayElemAt`

Suppose:

```js
{
  scores: [10, 20, 30]
}
```

Get first:

```js
{
  $arrayElemAt: [
    "$scores",
    0
  ]
}
```

Get second:

```js
{
  $arrayElemAt: [
    "$scores",
    1
  ]
}
```

Conceptually:

```js
scores[0]
```
