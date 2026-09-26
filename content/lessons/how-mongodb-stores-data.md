---
title: 'How MongoDB stores data'
module: 'documents-and-find'
track: 'fundamentals'
description: 'MongoDB stores documents in collections, not rows in tables. What that changes about how you model, nest and query your data.'
source: 'batch1.md:7-49'
---

Everything else in MongoDB follows from one idea: a record is a document, and a document can contain whole objects and arrays instead of pointing at other tables. Get this right and the rest of the query language stops feeling arbitrary.

MongoDB stores data as **documents** inside **collections**.

```js
// users collection

{
  _id: ObjectId("..."),
  name: "Denish",
  email: "denish@example.com",
  age: 28,
  skills: ["Node.js", "MongoDB", "Kafka"],
  address: {
    city: "Surat",
    country: "India"
  }
}
```

Think roughly:

```text
MongoDB              SQL
--------------------------------
Database             Database
Collection           Table
Document             Row
Field                Column
Embedded document    JSON/Object
Array                Usually separate table / JSON
```

But **don't think MongoDB is just "SQL but JSON"**.

The biggest difference is usually:

> In MongoDB, you design documents based heavily on how your application reads and writes data.

Choosing between them is the central schema design question in MongoDB, and the answer depends entirely on how you read the data back.

## Try it

One real document out of the sample data - embedded object, array and all:

```js
db.users.findOne({ _id: 101 })
```
