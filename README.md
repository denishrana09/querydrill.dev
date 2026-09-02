# MongoDB Practice Playground

A local page for drilling MongoDB against real data, built around the notes in
[batch1.md](batch1.md), [batch2.md](batch2.md) and [batch3.md](batch3.md).

Pick a database, seed it, write queries, and work through 38 auto-graded
exercises that tell you *why* an answer is wrong.

## Run it

```bash
npm install
npm start
```

Then open <http://127.0.0.1:4000>.

Needs a local `mongod` on `127.0.0.1:27017`. The banner prints the server
version it connected to, and the page shows a red dot if it cannot reach it.

## First time

1. Hit **+ new** and name a database (e.g. `practice`).
2. Leave the dataset on **ecommerce** and press **Seed**.
3. Open an exercise on the right, write your answer in the middle, press
   **Check**.

`Ctrl`+`Enter` runs whatever is in the editor.

## Datasets

| dataset | what it is |
|---|---|
| `ecommerce` | 30 users, 200 orders, 11 products. Same schemas as the notes, big enough that `$group` and `$lookup` return something interesting. **The exercises grade against this one.** |
| `notes` | The literal documents quoted in batch2 and batch3. Seed this into a *separate* database when you want to follow a note section line by line and get byte-identical output. |

Both are generated from a fixed seed, so re-seeding always produces the same
data. Seeding drops and reinserts only the collections the dataset owns, so
anything else in that database survives.

Re-seed from the terminal without the UI:

```bash
npm run seed -- --db practice --dataset ecommerce
```

## How grading works

Your answer and a hidden reference solution are run through the same executor,
against the same live database, and the results are diffed. Nothing is compared
to hardcoded JSON, so the expected answers cannot drift out of date when the
seed changes.

Feedback is field-level:

```
row 0.revenue: expected 53000, got 27000
result.address.country: missing from your result (expected "India")
Wrong number of results: expected 10, got 20.
```

The six **write** drills (marked `write`) mutate data. They re-seed the affected
collection before and after grading, so you can run them repeatedly and get the
same result every time.

Check that every exercise still passes its own solution:

```bash
npm run selfcheck
```

## The editor

It behaves like the mongo shell, not like driver code:

```js
db.orders.find({ status: "completed" }).limit(5)     // no .toArray() needed
db.orders.aggregate([{ $unwind: "$items" }])
db.users.countDocuments({ skills: "MongoDB" })
```

`ObjectId`, `ISODate`, `NumberInt`, `NumberLong`, `NumberDecimal` and `print`
are all available. A bare expression is the result; for multi-statement code use
an explicit `return`:

```js
const n = await db.orders.countDocuments({});
return { total: n };
```

Tick **explain** to re-run the same query with `executionStats` — useful once
you get to indexing.

## Notes on scope

This is not trying to replace **MongoDB Compass**. Install Compass too: its
stage-by-stage aggregation builder is the better tool for open-ended
exploration. What this playground adds is the seeded, note-matching data and
the graded exercise ladder, which Compass has no equivalent for.

## Security

The server binds to `127.0.0.1` only, and refuses to touch the `admin`, `local`
and `config` databases.

Beyond that: it executes the JavaScript you type. `node:vm` is used for
convenience, **not** as a security boundary — code that wants to escape it can.
That is fine for a single-user tool on your own machine running code you wrote
yourself. Do not expose this server to a network.
