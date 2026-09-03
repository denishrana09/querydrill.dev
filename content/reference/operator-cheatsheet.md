---
title: 'MongoDB operator cheatsheet'
kind: 'reference'
description: 'A MongoDB operator cheatsheet: query, update, array and aggregation operators with one-line meanings, plus six reusable pipeline patterns.'
source: 'batch1.md:1101-1182, batch2.md:1807-1836, batch3.md:1865-1991'
---

One page, no explanations - the operators grouped by what they are for, and the pipeline shapes worth carrying in your head. Every entry is covered properly in a lesson if you need the reasoning behind it.

## Querying and updating

If you forget everything else, remember these.

## Arrays

```text
Array contains value
→ { skills: "MongoDB" }

Any match
→ $in

All values required
→ $all

Multiple conditions on SAME array object
→ $elemMatch
```

## Nested objects

```text
"address.city": "Surat"
```

## Updates

```text
$set        Set field
$inc        Increment/decrement
$push       Add to array
$addToSet   Add without duplicates
$pull       Remove from array
```

## Important distinction

```text
$set: { address: {...} }

can replace the entire nested object
```

vs:

```text
$set: {
  "address.city": "Bangalore"
}
```

updates only that field.

## Pagination

```text
Small/simple pagination
→ skip + limit

Large datasets
→ cursor/range-based pagination
```

## Atomicity

```text
Single-document operations are atomic.
```

## `find()` vs `aggregate()`

```text
find()
→ retrieve/filter documents

aggregate()
→ transform/process documents through stages
```

## Aggregation stages

```text
$match
"Which documents?"

$project
"What should each document look like?"

$set
"What field do I want to add/change?"

$unwind
"Do I need to turn array elements into individual documents?"

$group
"Do I need to combine documents?"

$sort
"In what order?"

$limit
"How many?"

$skip
"Which results should I skip?"
```

## Advanced aggregation

```text
JOIN COLLECTION
→ $lookup

FILTER DOCUMENTS
→ $match

FILTER ARRAY ELEMENTS
→ $filter

TRANSFORM DOCUMENT
→ $project / $set

TRANSFORM ARRAY ELEMENTS
→ $map

FLATTEN ARRAY
→ $unwind

COMBINE DOCUMENTS
→ $group

REDUCE ONE ARRAY
→ $reduce

IF / ELSE
→ $cond

DEFAULT VALUE
→ $ifNull

ARRAY LENGTH
→ $size

GET ARRAY ELEMENT
→ $arrayElemAt

MULTIPLE RESULTS / STATS
→ $facet

GROUP BY DATE
→ $year / $month / $dateToString
```

## Patterns worth memorising

Not the syntax details - these shapes:

## Pattern A — Join

```text
Need another collection
→ $lookup

Need one joined object instead of an array
→ $unwind
```

## Pattern B — Array transformation

```text
Keep the array
→ $map / $filter
```

## Pattern C — Array analytics

```text
Need individual elements to participate
in grouping or pipeline stages

→ $unwind
```

## Pattern D — Array → single value

```text
items[]
↓
one calculated value

→ $reduce
```

## Pattern E — Conditional counts/sums

```text
$group
+
$sum
+
$cond
```

## Pattern F — Dashboard response

```text
Same filtered dataset
↓
Multiple calculations

→ $facet
```
