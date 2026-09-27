---
title: 'replaceOne vs $set'
module: 'updating-documents'
track: 'fundamentals'
description: 'replaceOne vs $set in MongoDB: one swaps the whole document, the other edits fields. Knowing which you called matters.'
topics: ['update', '$set']
source: 'batch1.md:1010-1063'
---

These two look interchangeable and are not. One edits the fields you name; the other throws away everything you did not name.

Given:

```js
{
  _id: 101,
  name: "Denish",
  age: 21,
  role: "admin"
}
```

Using:

```js
db.users.replaceOne(
  { _id: 101 },
  {
    name: "New Name"
  }
)
```

The document becomes essentially:

```js
{
  _id: 101,
  name: "New Name"
}
```

You replaced the document.

Whereas:

```js
db.users.updateOne(
  { _id: 101 },
  {
    $set: {
      name: "New Name"
    }
  }
)
```

keeps everything else.
