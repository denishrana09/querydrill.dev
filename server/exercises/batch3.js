// Batch 3 - advanced: $lookup, $filter, $map, $reduce, $cond, $facet, dates.

export default [
  {
    id: 'lookup-join',
    difficulty: 'medium',
    topics: ['$lookup'],
    title: '$lookup - the join',
    prompt:
      'For orders 1, 2 and 3, attach the matching `users` document as an array field named `user`. Project `_id`, `userId` and `user`. Sort by `_id` ascending.',
    lesson: 'lookup-basics',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $lookup: {\n    from: "users",\n    localField: "",\n    foreignField: "",\n    as: "user"\n  } },\n  { $project: { userId: 1, user: 1 } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'localField is on `orders`, foreignField is on `users`. Remember $lookup always produces an ARRAY.',
    mistakes: [
      'Swapping `localField` and `foreignField` is not an error. Every `user` array simply comes back empty.',
      'The result is always an array, even one-to-one. An order whose join found nothing gets `[]`, not a missing field.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $project: { userId: 1, user: 1 } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'flatten-a-join',
    difficulty: 'medium',
    topics: ['$lookup', '$unwind'],
    title: '$lookup + $unwind - flatten the join',
    prompt:
      'Same three orders, but `user` must be a single OBJECT rather than a one-element array. Return `_id`, `userId` and `userName` (the joined name). Sort by `_id` ascending.',
    lesson: 'unwind-after-lookup',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $unwind: "" },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } },\n  { $unwind: "" },\n  { $project: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$unwind the lookup array, then reach into it with "$user.name".',
    mistakes: [
      '`"$user.name"` before the `$unwind` reads a field off an array, and gives you an array of names.',
      '`$unwind` drops any order whose join found nothing. `preserveNullAndEmptyArrays: true` keeps them, and without it a failed join becomes a missing row.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $project: { userId: 1, userName: "$user.name" } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'pipeline-lookup',
    difficulty: 'hard',
    topics: ['$lookup', '$expr'],
    title: 'Pipeline $lookup with let / $expr',
    prompt:
      'For users 101 and 102, attach only their COMPLETED orders as an array `completedOrders`, each entry projected down to `{ _id, status }`. Use the pipeline form of $lookup.\n\nProject `_id`, `name`, `completedOrders`. Sort by `_id` ascending.',
    lesson: 'pipeline-lookup',
    starter: 'db.users.aggregate([\n  { $match: {} },\n  { $lookup: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.users.aggregate([\n  { $match: { _id: { $in: [101, 102] } } },\n  { $lookup: {\n    from: "orders",\n    let: { },\n    pipeline: [ ],\n    as: "completedOrders"\n  } },\n  { $project: { name: 1, completedOrders: 1 } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Outer variables declared in `let` are referenced with TWO dollar signs inside the pipeline: "$$userId". Comparing them needs $expr.',
    mistakes: [
      'One `$` instead of two: inside the sub-pipeline `"$userId"` is the joined collection field, and comparing it to itself matches every order.',
      '`$match: { userId: "$$userId" }` compares a field to a literal string. Comparing a field to an expression needs `$expr`.',
    ],
    unordered: false,
    solution:
      'db.users.aggregate([{ $match: { _id: { $in: [101, 102] } } }, { $lookup: { from: "orders", let: { userId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", "completed"] }] } } }, { $project: { _id: 1, status: 1 } }, { $sort: { _id: 1 } }], as: "completedOrders" } }, { $project: { name: 1, completedOrders: 1 } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'filter-array',
    difficulty: 'medium',
    topics: ['$filter', 'arrays'],
    title: '$filter - keep some array elements',
    prompt:
      'For orders 1 to 5, return `_id` and `pricyItems`: only those `items` whose price is 200 or more. The other fields of each item stay as they are. Sort by `_id` ascending.',
    lesson: 'filter-operator',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    pricyItems: { $filter: { } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$filter takes input, as, cond. Inside `cond` the element is "$$this" or whatever you named in `as`.',
    mistakes: [
      'Inside `cond` the element is `"$$i"`. One `$` looks for a field called `i` on the order, finds nothing, and the condition is false for everything.',
      'If the items came back reshaped rather than whole, that is `$map`. `$filter` returns the elements it was given.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { pricyItems: { $filter: { input: "$items", as: "i", cond: { $gte: ["$$i.price", 200] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'map-array',
    difficulty: 'medium',
    topics: ['$map', 'arrays'],
    title: '$map - transform every element',
    prompt:
      'For orders 1 to 5, return `_id` and `lineTotals`: an array holding price x quantity for each item, in the same order. Sort by `_id` ascending.',
    lesson: 'map-operator',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    lineTotals: { $map: { } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$map keeps the array the same length and reshapes each element - no $unwind, no document explosion.',
    mistakes: [
      '`$unwind` gives one document per item instead of one array per order: the right numbers in the wrong shape.',
      'Inside `in` the element is `"$$i"`, so the price is `"$$i.price"`. `"$price"` looks for a top-level field on the order.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { lineTotals: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.price", "$$i.quantity"] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'reduce-array',
    difficulty: 'hard',
    topics: ['$reduce', 'arrays'],
    title: '$reduce - array down to one value',
    prompt:
      'For orders 1 to 5, return `_id` and `orderTotal`: the sum of price x quantity across all items - computed WITHOUT $unwind. Sort by `_id` ascending.',
    lesson: 'reduce-operator',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 5 } } },\n  { $project: {\n    orderTotal: { $reduce: {\n      input: "$items",\n      initialValue: 0,\n      in: { }\n    } }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Inside `in`, "$$value" is the running accumulator and "$$this" is the current element.',
    mistakes: [
      '`initialValue` is not optional, and starting from `[]` when you are adding numbers fails on the first element.',
      '`"$$value"` is the total so far and `"$$this"` is the current item. Swapping them is not an error, it is just a wrong total.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 5 } } }, { $project: { orderTotal: { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'conditional-counting',
    difficulty: 'medium',
    topics: ['$cond', '$group'],
    title: '$cond - conditional counting',
    prompt:
      'In ONE pass over `orders`, produce a single document { _id: null, completed, pending, cancelled } counting orders of each status.\n\nNo $match, no three separate queries - use $cond inside the accumulators.',
    lesson: 'cond-operator',
    starter: 'db.orders.aggregate([\n  { $group: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $group: {\n    _id: null,\n    completed: { $sum: { $cond: [] } }\n  } }\n])',
    hint: '{ $sum: { $cond: [ <test>, 1, 0 ] } } adds 1 only when the test passes.',
    mistakes: [
      'The `$cond` goes inside the `$sum`, producing 1 or 0 per document. A `$sum: 1` inside a `$cond` counts everything.',
      'The array form takes exactly three parts: test, value if true, value if false. Leaving the last one out errors.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $group: { _id: null, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } }])',
  },
  {
    id: 'ifnull-default',
    difficulty: 'easy',
    topics: ['$ifNull'],
    title: '$ifNull - defaults for missing fields',
    prompt:
      'Only some orders have a `discount` field. For orders 1 to 8, return `_id`, `discount` as-is, and `effectiveDiscount` which falls back to 0 when `discount` is missing. Sort by `_id` ascending.',
    lesson: 'ifnull-operator',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 8 } } },\n  { $project: {\n    discount: 1,\n    effectiveDiscount: { }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '{ $ifNull: [ "$field", <fallback> ] }',
    mistakes: [
      'Without the `$`, `{ $ifNull: ["discount", 0] }` tests the string `"discount"`, which is never null, so every row comes back with the word discount as its value.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 8 } } }, { $project: { discount: 1, effectiveDiscount: { $ifNull: ["$discount", 0] } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'facet-dashboard',
    difficulty: 'hard',
    topics: ['$facet'],
    title: '$facet - dashboard in one query',
    prompt:
      'Return ONE document with three independently computed fields:\n\n- `byStatus`: count per status as { _id, count }, sorted by `_id` ascending\n- `topProducts`: top 3 products by total quantity sold, as { _id, qty } sorted by qty descending\n- `totalOrders`: a single-element array like [{ n: <count> }]\n\nAll from `orders`, in a single pass.',
    lesson: 'facet-stage',
    starter: 'db.orders.aggregate([\n  { $facet: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $facet: {\n    byStatus: [ ],\n    topProducts: [ ],\n    totalOrders: [ ]\n  } }\n])',
    hint: 'Each key in $facet holds its own complete sub-pipeline, all fed the same input documents.',
    mistakes: [
      'The sub-pipelines cannot see each other. Each one starts again from the documents that entered `$facet`.',
      '`$facet` returns exactly one document and every key holds an array. `totalOrders` being `[{ n: ... }]` is the shape asked for, not something to flatten.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $facet: { byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }], topProducts: [{ $unwind: "$items" }, { $group: { _id: "$items.product", qty: { $sum: "$items.quantity" } } }, { $sort: { qty: -1 } }, { $limit: 3 }], totalOrders: [{ $count: "n" }] } }])',
  },
  {
    id: 'facet-pagination',
    difficulty: 'hard',
    topics: ['$facet', '$skip', '$limit'],
    title: '$facet - page of results plus total count',
    prompt:
      'The classic paginated API response. From completed orders sorted by `createdAt` descending, return one document with:\n\n- `data`: rows 6-10 (skip 5, limit 5), projected to { _id, userId, createdAt }\n- `total`: the FULL number of completed orders, not just the page\n\nMake `total` a plain number, not an array.',
    lesson: 'facet-pagination',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $facet: {} },\n  { $set: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { status: "completed" } },\n  { $facet: {\n    data: [ ],\n    total: [ ]\n  } },\n  { $set: { total: { } } }\n])',
    hint: '$count produces [{ n: 130 }]. Flatten it with { $arrayElemAt: ["$total.n", 0] }.',
    mistakes: [
      'Filtering inside each sub-pipeline instead of before `$facet` lets `data` and `total` count different sets, which is the bug this shape exists to avoid.',
      '`$count` produces `[{ n: 130 }]`, so `"$total.n"` is `[130]`. Still an array, one level less wrong.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $facet: { data: [{ $sort: { createdAt: -1 } }, { $skip: 5 }, { $limit: 5 }, { $project: { userId: 1, createdAt: 1 } }], total: [{ $count: "n" }] } }, { $set: { total: { $arrayElemAt: ["$total.n", 0] } } }])',
  },
  {
    id: 'group-by-month',
    difficulty: 'medium',
    topics: ['dates', '$dateToString', '$group'],
    title: '$dateToString - group by month label',
    prompt:
      'Count completed orders per month, labelled "YYYY-MM". Output { _id: "2026-01", count: <n> } sorted by `_id` ascending.',
    lesson: 'date-aggregation',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $group: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { status: "completed" } },\n  { $group: {\n    _id: { $dateToString: { } },\n    count: { $sum: 1 }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '{ $dateToString: { format: "%Y-%m", date: "$createdAt" } }',
    mistakes: [
      '`{ $month: "$createdAt" }` gives `1`, not `"2026-01"`, and it merges January of two different years into one group.',
      'A `"%Y-%m"` string sorts correctly because it is zero-padded and biggest unit first. `"%m-%Y"` would put April before January.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'filter-then-calculate',
    difficulty: 'hard',
    topics: ['$filter', '$map', '$sum'],
    title: 'Filter an array, THEN calculate',
    prompt:
      'For orders 1 to 10, return `_id` and `electronicsTotal`: the summed price x quantity of ONLY the items in category "Electronics". Orders with no electronics must still appear, with 0.\n\nDo not use $unwind - work on the array in place. Sort by `_id` ascending.',
    lesson: 'filter-then-calculate',
    starter: 'db.orders.aggregate([\n  { $match: {} },\n  { $project: {} },\n  { $sort: {} }\n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $lte: 10 } } },\n  { $project: {\n    electronicsTotal: { }\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Compose them: $sum over a $map over the result of a $filter.',
    mistakes: [
      '`$sum` straight over the `$filter` result adds whole item objects rather than numbers. The `$map` in between is what turns them into line totals.',
      'Filtering the category out with `$match` instead drops the orders that have no Electronics, and the prompt wants them present with 0.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $lte: 10 } } }, { $project: { electronicsTotal: { $sum: { $map: { input: { $filter: { input: "$items", as: "i", cond: { $eq: ["$$i.category", "Electronics"] } } }, as: "e", in: { $multiply: ["$$e.price", "$$e.quantity"] } } } } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'capstone-top-customers',
    difficulty: 'hard',
    topics: ['$lookup', '$unwind', '$group'],
    title: 'Full coding-round problem',
    prompt:
      'A full coding-round question, of the kind that gets asked in an interview.\n\nFind the top 5 users by total spending across COMPLETED orders, including the name of each one. Output { _id: <userId>, name: <string>, totalSpent: <n> } sorted by totalSpent descending.\n\nThe spending is in `orders`; the names are in `users`.',
    lesson: 'coding-round-walkthrough',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: {} },\n  { $unwind: "" },\n  { $group: {} },\n  { $sort: {} },\n  { $limit: 5 },\n  { $lookup: {} },\n  { $unwind: "" },\n  { $project: {} },\n  { $sort: {} }\n])',
    hint: 'Do the $group and $limit BEFORE the $lookup.',
    mistakes: [
      '`$lookup` before the `$group` joins every completed order and then throws most of that work away. The answer is right and the pipeline is far more expensive than it needs to be.',
      '`$lookup` leaves `user` as an array, so without the `$unwind` the name comes out as a one-element array rather than a string.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$userId", totalSpent: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { totalSpent: -1 } }, { $limit: 5 }, { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } }, { $unwind: "$user" }, { $project: { name: "$user.name", totalSpent: 1 } }, { $sort: { totalSpent: -1 } }])',
  },
];
