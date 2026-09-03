// Batch 3 - advanced: $lookup, $filter, $map, $reduce, $cond, $facet, dates.

export default [
  {
    id: 'b3-01',
    title: '$lookup - the join',
    prompt:
      'For orders 1, 2 and 3, attach the matching `users` document as an array field named `user`. Project `_id`, `userId` and `user`. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 24, label: 'Batch 3 - $lookup' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $lookup: {\n    from: "users",\n    localField: "",\n    foreignField: "",\n    as: "user"\n  } },\n  { $project: { userId: 1, user: 1 } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'localField is on `orders`, foreignField is on `users`. Remember $lookup always produces an ARRAY.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $project: { userId: 1, user: 1 } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-02',
    title: '$lookup + $unwind - flatten the join',
    prompt:
      'Same three orders, but `user` must be a single OBJECT rather than a one-element array. Return `_id`, `userId` and `userName` (the joined name). Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 131, label: 'Batch 3 - $unwind After $lookup' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $unwind: "" },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },\n  { $unwind: "" },\n  { $project: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$unwind the lookup array, then reach into it with "$user.name".',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $project: { userId: 1, userName: "$user.name" } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-03',
    title: 'Pipeline $lookup with let / $expr',
    prompt:
      'For users 101 and 102, attach only their COMPLETED orders as an array `completedOrders`, each entry projected down to `{ _id, status }`. Use the pipeline form of $lookup.\n\nProject `_id`, `name`, `completedOrders`. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 234, label: 'Batch 3 - Advanced $lookup' },
    starter: 'db.users.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.users.aggregate([\n  { $match: { _id: { $in: [101, 102] } } },\n  { $lookup: {\n    from: "orders",\n    let: { },\n    pipeline: [ ],\n    as: "completedOrders"\n  } },\n  { $project: { name: 1, completedOrders: 1 } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Outer variables declared in `let` are referenced with TWO dollar signs inside the pipeline: "$$userId". Comparing them needs $expr.',
    unordered: false,
    solution:
      'db.users.aggregate([{ $match: { _id: { $in: [101, 102] } } }, { $lookup: { from: "orders", let: { userId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", "completed"] }] } } }, { $project: { _id: 1, status: 1 } }, { $sort: { _id: 1 } }], as: "completedOrders" } }, { $project: { name: 1, completedOrders: 1 } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-04',
    title: '$filter - keep some array elements',
    prompt:
      'For orders 1 to 5, return `_id` and `pricyItems`: only those `items` whose price is 200 or more. The other fields of each item stay as they are. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 406, label: 'Batch 3 - $filter' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    pricyItems: { $filter: { } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$filter takes input, as, cond. Inside `cond` the element is "$$this" or whatever you named in `as`.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { pricyItems: { $filter: { input: "$items", as: "i", cond: { $gte: ["$$i.price", 200] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-05',
    title: '$map - transform every element',
    prompt:
      'For orders 1 to 5, return `_id` and `lineTotals`: an array holding price x quantity for each item, in the same order. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 531, label: 'Batch 3 - $map' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    lineTotals: { $map: { } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$map keeps the array the same length and reshapes each element - no $unwind, no document explosion.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { lineTotals: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.price", "$$i.quantity"] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-06',
    title: '$reduce - array down to one value',
    prompt:
      'For orders 1 to 5, return `_id` and `orderTotal`: the sum of price x quantity across all items - computed WITHOUT $unwind. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 748, label: 'Batch 3 - Order Total Without $unwind' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    orderTotal: { $reduce: {\n      input: "$items",\n      initialValue: 0,\n      in: { }\n    } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Inside `in`, "$$value" is the running accumulator and "$$this" is the current element.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { orderTotal: { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-07',
    title: '$cond - conditional counting',
    prompt:
      'In ONE pass over `orders`, produce a single document { _id: null, completed, pending, cancelled } counting orders of each status.\n\nNo $match, no three separate queries - use $cond inside the accumulators.',
    noteRef: { file: 'batch3.md', line: 892, label: 'Batch 3 - Conditional Counting' },
    starter: 'db.orders.aggregate([\n  { $group: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $group: {\n    _id: null,\n    completed: { $sum: { $cond: [] } }\n  } }\n])',
    hint: '{ $sum: { $cond: [ <test>, 1, 0 ] } } adds 1 only when the test passes.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $group: { _id: null, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } }])',
  },
  {
    id: 'b3-08',
    title: '$ifNull - defaults for missing fields',
    prompt:
      'Only some orders have a `discount` field. For orders 1 to 8, return `_id`, `discount` as-is, and `effectiveDiscount` which falls back to 0 when `discount` is missing. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 946, label: 'Batch 3 - $ifNull' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 8 } } },\n  { $project: {\n    discount: 1,\n    effectiveDiscount: { }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '{ $ifNull: [ "$field", <fallback> ] }',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 8 } } }, { $project: { discount: 1, effectiveDiscount: { $ifNull: ["$discount", 0] } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-09',
    title: '$facet - dashboard in one query',
    prompt:
      'Return ONE document with three independently computed fields:\n\n- `byStatus`: count per status as { _id, count }, sorted by `_id` ascending\n- `topProducts`: top 3 products by total quantity sold, as { _id, qty } sorted by qty descending\n- `totalOrders`: a single-element array like [{ n: 200 }]\n\nAll from `orders`, in a single pass.',
    noteRef: { file: 'batch3.md', line: 1071, label: 'Batch 3 - $facet' },
    starter: 'db.orders.aggregate([\n  { $facet: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $facet: {\n    byStatus: [ ],\n    topProducts: [ ],\n    totalOrders: [ ]\n  } }\n])',
    hint: 'Each key in $facet holds its own complete sub-pipeline, all fed the same input documents.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $facet: { byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }], topProducts: [{ $unwind: "$items" }, { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } }, { $sort: { qty: -1 } }, { $limit: 3 }], totalOrders: [{ $count: "n" }] } }])',
  },
  {
    id: 'b3-10',
    title: '$facet - page of results plus total count',
    prompt:
      'The classic paginated API response. From completed orders sorted by `createdAt` descending, return one document with:\n\n- `data`: rows 6-10 (skip 5, limit 5), projected to { _id, userId, createdAt }\n- `total`: the FULL number of completed orders, not just the page\n\nMake `total` a plain number, not an array.',
    noteRef: { file: 'batch3.md', line: 1195, label: 'Batch 3 - Pagination + Total Count' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $facet: {} },\n  { $set: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { status: "completed" } },\n  { $facet: {\n    data: [ ],\n    total: [ ]\n  } },\n  { $set: { total: { } } }\n])',
    hint: '$count produces [{ n: 130 }]. Flatten it with { $arrayElemAt: ["$total.n", 0] }.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $facet: { data: [{ $sort: { createdAt: -1 } }, { $skip: 5 }, { $limit: 5 }, { $project: { userId: 1, createdAt: 1 } }], total: [{ $count: "n" }] } }, { $set: { total: { $arrayElemAt: ["$total.n", 0] } } }])',
  },
  {
    id: 'b3-11',
    title: '$dateToString - group by month label',
    prompt:
      'Count completed orders per month, labelled "YYYY-MM". Output { _id: "2026-01", count: <n> } sorted by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 1314, label: 'Batch 3 - $dateToString' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $group: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { status: "completed" } },\n  { $group: {\n    _id: { $dateToString: { } },\n    count: { $sum: 1 }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '{ $dateToString: { format: "%Y-%m", date: "$createdAt" } }',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-12',
    title: 'Filter an array, THEN calculate',
    prompt:
      'For orders 1 to 10, return `_id` and `electronicsTotal`: the summed price x quantity of ONLY the items in category "Electronics". Orders with no electronics must still appear, with 0.\n\nDo not use $unwind - filter the array, then reduce it. Sort by `_id` ascending.',
    noteRef: { file: 'batch3.md', line: 1608, label: 'Batch 3 - Filter an Array, Then Calculate' },
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 10 } } },\n  { $project: {\n    electronicsTotal: { }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Compose them: $sum over a $map over the result of a $filter.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 10 } } }, { $project: { electronicsTotal: { $sum: { $map: { input: { $filter: { input: "$items", as: "i", cond: { $eq: ["$$i.category", "Electronics"] } } }, as: "e", in: { $multiply: ["$$e.price", "$$e.quantity"] } } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b3-13',
    title: 'Full coding-round problem',
    prompt:
      'The interview question from the end of Batch 3.\n\nFind the top 5 users by total spending across COMPLETED orders, including their names. Output { _id: <userId>, name: <string>, totalSpent: <n> } sorted by totalSpent descending.\n\nThink about the order: filter, explode the items, total per user, rank, join the user, flatten.',
    noteRef: { file: 'batch3.md', line: 1357, label: 'Batch 3 - Full Coding-Round Style Example' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: {} },\n  { $unwind: "" },\n  { $group: {} },\n  { $sort: {} },\n  { $limit: 5 },\n  { $lookup: {} },\n  { $unwind: "" },\n  { $project: {} },\n  { $sort: {} }\n])',
    hint: 'Do the $group and $limit BEFORE the $lookup - joining 200 orders and then grouping does far more work than joining 5 results.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$userId", totalSpent: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { totalSpent: -1 } }, { $limit: 5 }, { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $project: { name: "$user.name", totalSpent: 1 } }, { $sort: { totalSpent: -1 } }])',
  },
];
