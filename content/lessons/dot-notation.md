---
title: 'Dot notation into nested objects'
module: 'nested-and-arrays'
track: 'fundamentals'
description: 'Query fields inside nested MongoDB objects with dot notation: { "address.city": "Bangalore" }, and why the path needs quotes.'
topics: ['find', 'nested']
source: 'batch1.md:225-253'
---

To reach a field inside a sub-document, name the path and quote it. There is no join and no special operator - `"address.city"` is just a field name that happens to contain a dot.

Given:

```js
{
  name: "Denish",

  address: {
    city: "Surat",
    country: "India"
  }
}
```

Query:

```js
db.users.find({
  "address.city": "Surat"
})
```

The important concept is **dot notation**.

You will use it constantly.
