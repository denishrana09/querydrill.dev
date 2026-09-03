// Batch 2 - aggregation foundation: $match, $project, $group, $unwind, $sort.

export default [
  {
    id: 'b2-01',
    title: '$match then $sort',
    prompt:
      'Using `orders`, keep only completed orders, sort by `createdAt` descending, and return the 3 newest. Project `_id`, `userId`, `status`, `createdAt`.',
    noteRef: { file: 'batch2.md', line: 150, label: 'Batch 2 - $match' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $sort: { } },\n  { $limit: 3 },\n  { $project: { userId: 1, status: 1, createdAt: 1 } }\n])',
    hint: '$match first - filtering early is the whole performance rule in the notes.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $sort: { createdAt: -1 } }, { $limit: 3 }, { $project: { userId: 1, status: 1, createdAt: 1 } }])',
  },
  {
    id: 'b2-02',
    title: '$project with a computed field',
    prompt:
      'For orders 1, 2 and 3, return `_id` and a new field `itemCount` holding how many entries are in `items`. Nothing else. Sort by `_id` ascending.',
    noteRef: { file: 'batch2.md', line: 310, label: 'Batch 2 - $project can create fields' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $project: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$size returns the length of an array. Reference the field as "$items".',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $project: { itemCount: { $size: "$items" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b2-03',
    title: 'Count by group',
    prompt: 'Count orders per `status`. Output `{ _id: <status>, count: <n> }`.',
    noteRef: { file: 'batch2.md', line: 1709, label: 'Batch 2 - Pattern 1: Count by X' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $group: { } }\n])',
    hint: 'The accumulator for counting is { $sum: 1 }.',
    unordered: true,
    solution: 'db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])',
  },
  {
    id: 'b2-04',
    title: 'Several accumulators at once',
    prompt:
      'For each `status`, return `count`, `avgDiscount` (average of `discount`), `maxDiscount` and `minDiscount`. Sort by `_id` ascending.',
    noteRef: { file: 'batch2.md', line: 675, label: 'Batch 2 - The Main $group Accumulators' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $group: {\n    _id: "$status"\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$avg, $max and $min all skip documents where the field is missing.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, avgDiscount: { $avg: "$discount" }, maxDiscount: { $max: "$discount" }, minDiscount: { $min: "$discount" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b2-05',
    title: '$unwind + $group - revenue per product',
    prompt:
      'Total revenue per product across COMPLETED orders only. Revenue for a line item is price x quantity. Output `{ _id: <product>, revenue: <n> }` sorted by revenue descending.\n\nThe notes call this the single most important aggregation pattern.',
    noteRef: { file: 'batch2.md', line: 1072, label: 'Batch 2 - Calculating Revenue Per Product' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $unwind: "$items" },\n  { $group: { } },\n  { $sort: { revenue: -1 } }\n])',
    hint: 'After $unwind each document holds ONE item. Use { $multiply: ["$items.price", "$items.quantity"] } - summing price alone is the classic slip.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$items.product", revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { revenue: -1 } }])',
  },
  {
    id: 'b2-06',
    title: '$push vs $addToSet inside $group',
    prompt:
      'For each `status`, return two numbers:\n\n- `lineItems`: how many item entries were ordered under that status in total (duplicates counted)\n- `distinctProducts`: how many DIFFERENT products appear under that status\n\nOutput { _id, lineItems, distinctProducts } sorted by `_id` ascending.\n\nIf your two numbers come out equal, you used the accumulator that keeps duplicates.',
    noteRef: { file: 'batch2.md', line: 718, label: 'Batch 2 - $push vs $addToSet inside $group' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $unwind: "$items" },\n  { $group: {\n    _id: "$status",\n    lineItems: { $sum: 1 },\n    products: { }\n  } },\n  { $project: { lineItems: 1, distinctProducts: { $size: "$products" } } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$push keeps every value including repeats; $addToSet de-duplicates. Collect with one of them, then take the $size.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $unwind: "$items" }, { $group: { _id: "$status", lineItems: { $sum: 1 }, products: { $addToSet: "$items.product" } } }, { $project: { lineItems: 1, distinctProducts: { $size: "$products" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b2-07',
    title: 'Top N customers by spend',
    prompt:
      'Find the top 5 users by total spending across completed orders. Output `{ _id: <userId>, totalSpent: <n> }` sorted by totalSpent descending.',
    noteRef: { file: 'batch2.md', line: 1841, label: 'Batch 2 - Self-test Q1' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $unwind: "$items" },\n  { $group: { } },\n  { $sort: { } },\n  { $limit: 5 }\n])',
    hint: 'Group by "$userId" after unwinding, then sort and limit. $sort must come before $limit.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$userId", totalSpent: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { totalSpent: -1 } }, { $limit: 5 }])',
  },
  {
    id: 'b2-08',
    title: 'Group by multiple fields',
    prompt:
      'Count orders grouped by BOTH `userId` and `status`, for users 101, 102 and 103 only. The `_id` must be an object `{ userId, status }`, plus a `count`. Sort by `_id.userId` then `_id.status`, both ascending.',
    noteRef: { file: 'batch2.md', line: 1159, label: 'Batch 2 - $group by multiple fields' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { userId: { $in: [101, 102, 103] } } },\n  { $group: { _id: { }, count: { $sum: 1 } } },\n  { $sort: { "_id.userId": 1, "_id.status": 1 } }\n])',
    hint: 'The _id can be an object. Its keys together form the composite grouping key.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { userId: { $in: [101, 102, 103] } } }, { $group: { _id: { userId: "$userId", status: "$status" }, count: { $sum: 1 } } }, { $sort: { "_id.userId": 1, "_id.status": 1 } }])',
  },
  {
    id: 'b2-09',
    title: '$first after sorting - latest order per user',
    prompt:
      'Find the most recent order for each of users 101, 102 and 103. Output `{ _id: <userId>, latestOrderId: <n>, latestDate: <date> }` sorted by `_id` ascending.',
    noteRef: { file: 'batch2.md', line: 1274, label: 'Batch 2 - $first and $last' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { userId: { $in: [101, 102, 103] } } },\n  { $sort: { } },\n  { $group: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$first is only meaningful after an explicit $sort - it takes whichever document arrives first in each group.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { userId: { $in: [101, 102, 103] } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$userId", latestOrderId: { $first: "$_id" }, latestDate: { $first: "$createdAt" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'b2-10',
    title: 'Average order value per month',
    prompt:
      'For completed orders placed in 2026, compute the average ORDER value per calendar month. An order value is the sum of price x quantity across all of its items.\n\nOutput `{ _id: <month number>, avgOrderValue: <n> }` sorted by month ascending.\n\nWatch the order of operations - you must total each order before averaging, or you will be averaging line items instead.',
    noteRef: { file: 'batch2.md', line: 1873, label: 'Batch 2 - Self-test Q3' },
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $set: { orderTotal: { } } },\n  { $group: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Compute a per-order total first ($sum over a $map of the items array), then group by { $month: "$createdAt" } and $avg that total.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed", createdAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") } } }, { $set: { orderTotal: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.price", "$$i.quantity"] } } } } } }, { $group: { _id: { $month: "$createdAt" }, avgOrderValue: { $avg: "$orderTotal" } } }, { $sort: { _id: 1 } }])',
  },
];
