---
title: 'Upsert: insert or update'
module: 'updating-documents'
track: 'fundamentals'
description: 'MongoDB upsert: update a document if it exists, insert it if it does not, in a single atomic operation.'
operators: ['$set']
source: 'batch1.md:1064-1100'
---

An upsert is "update, or insert if there was nothing to update". It is one operation, so it does not have the race condition that a find-then-insert has - which is the reason to use it, not the convenience.

```js
db.users.updateOne(
  {
    email: "denish@example.com"
  },
  {
    $set: {
      name: "Denish"
    }
  },
  {
    upsert: true
  }
)
```

Meaning:

```text
If document exists
    → update it

If it doesn't exist
    → insert it
```

Useful in:

* synchronization jobs
* migrations
* external integrations
* idempotent operations
