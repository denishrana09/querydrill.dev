---
title: '$match vs $filter, $project vs $map, $group vs $reduce'
kind: 'reference'
description: 'MongoDB operators that look interchangeable and are not: $match vs $filter, $project vs $map, $group vs $reduce, $map vs $unwind.'
source: 'batch3.md:1795-1864'
---

Four pairs of operators that get confused constantly. In each pair the difference is the same question: does this act on documents, or on the elements inside one document?

## `$match` vs `$filter`

```text
$match

Filters documents.
```

```text
$filter

Filters elements inside an array.
```

## `$project` vs `$map`

```text
$project

Transforms a document.
```

```text
$map

Transforms every element inside an array.
```

## `$group` vs `$reduce`

```text
$group

Combines multiple pipeline documents.
```

```text
$reduce

Combines/reduces elements inside one array.
```

## `$map` vs `$unwind`

```text
$map

Keep array structure.
Transform elements.
```

```text
$unwind

Destroy/flatten array structure.
Each element becomes a pipeline document.
```
