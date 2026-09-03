---
title: 'Projection: choosing fields'
module: 'documents-and-find'
track: 'fundamentals'
description: 'MongoDB projection: return only the fields you need with find({}, { name: 1 }), and why _id keeps showing up uninvited.'
source: 'batch1.md:433-503'
---

A projection is the second argument to `find()`, and it decides which fields come back. Two rules cover almost everything: you cannot mix inclusion and exclusion in one projection, and `_id` is included unless you explicitly turn it off.

Suppose the document contains:

```js
{
  _id: 1,
  name: "Denish",
  email: "denish@example.com",
  passwordHash: "secret",
  address: {...}
}
```

You probably don't want everything.

```js
db.users.find(
  {
    status: "active"
  },
  {
    name: 1,
    email: 1
  }
)
```

Result:

```js
{
  _id: 1,
  name: "Denish",
  email: "denish@example.com"
}
```

`_id` is included by default.

Exclude it:

```js
db.users.find(
  {},
  {
    _id: 0,
    name: 1,
    email: 1
  }
)
```

## Exclusion projection

```js
db.users.find(
  {},
  {
    passwordHash: 0,
    internalNotes: 0
  }
)
```

Generally, you **don't mix inclusion and exclusion** in the same projection, except `_id`.
