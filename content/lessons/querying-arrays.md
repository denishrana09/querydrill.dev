---
title: 'Querying arrays'
module: 'nested-and-arrays'
track: 'fundamentals'
description: 'How MongoDB matches arrays: a scalar match tests every element, and $all requires all of your values to be present.'
operators: ['$all', '$contains', '$in']
source: 'batch1.md:254-320'
---

Arrays behave in a way that surprises people coming from SQL: matching an array field against a single value asks "does any element equal this?". That one rule explains most array queries you will write.

Suppose:

```js
{
  name: "Denish",
  skills: ["Node.js", "MongoDB", "Kafka"]
}
```

Find people with MongoDB:

```js
db.users.find({
  skills: "MongoDB"
})
```

MongoDB automatically matches an element inside the array.

You don't need:

```js
{
  skills: {
    $contains: "MongoDB"
  }
}
```

That doesn't exist.

## Find documents containing any of these

```js
db.users.find({
  skills: {
    $in: ["MongoDB", "Redis"]
  }
})
```

Meaning:

> User has MongoDB **OR** Redis.

## Find documents containing all of these

```js
db.users.find({
  skills: {
    $all: ["MongoDB", "Redis"]
  }
})
```

Meaning:

> User must have both.
