---
title: 'update() and $set'
module: 'updating-documents'
track: 'fundamentals'
description: 'MongoDB $set, and the update that silently deletes every other field in your document. The most expensive beginner mistake.'
operators: ['$set']
source: 'batch1.md:598-681'
---

Updates are where MongoDB will genuinely destroy your data if you get the syntax slightly wrong. The rule is short: without an update operator, you are not editing a document, you are replacing it.

Suppose:

```js
{
  _id: 101,
  name: "Denish",
  age: 21,
  skills: ["Node.js", "Kafka"]
}
```

## `$set`

```js
db.users.updateOne(
  { _id: 101 },
  {
    $set: {
      age: 29
    }
  }
)
```

## ⚠️ Dangerous mistake

Suppose:

```js
address: {
  city: "Surat",
  country: "India"
}
```

You do:

```js
$set: {
  address: {
    city: "Bangalore"
  }
}
```

Result:

```js
address: {
  city: "Bangalore"
}
```

You replaced the entire object.

If you want only the city:

```js
$set: {
  "address.city": "Bangalore"
}
```

Result:

```js
address: {
  city: "Bangalore",
  country: "India"
}
```

Again: **dot notation matters**.
