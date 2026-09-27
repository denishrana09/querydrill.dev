// Batch 2 - aggregation foundation: $match, $project, $group, $unwind, $sort.

export default [
  {
    id: 'match-then-sort',
    difficulty: 'easy',
    topics: ['$match', '$sort'],
    title: '$match then $sort',
    prompt:
      'Using `orders`, keep only completed orders, sort by `createdAt` descending, and return the 3 newest. Project `_id`, `userId`, `status`, `createdAt`.',
    lesson: 'match-stage',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $sort: { } },\n  { $limit: 3 },\n  { $project: { userId: 1, status: 1, createdAt: 1 } }\n])',
    hint: '$match first - filtering before the expensive stages is the whole performance rule.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $sort: { createdAt: -1 } }, { $limit: 3 }, { $project: { userId: 1, status: 1, createdAt: 1 } }])',
  },
  {
    id: 'project-computed-field',
    difficulty: 'medium',
    topics: ['$project', '$size'],
    title: '$project with a computed field',
    prompt:
      'For orders 1, 2 and 3, return `_id` and a new field `itemCount` holding how many entries are in `items`. Nothing else. Sort by `_id` ascending.',
    lesson: 'project-stage',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { _id: { $in: [1, 2, 3] } } },\n  { $project: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$size returns the length of an array. Reference the field as "$items".',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { _id: { $in: [1, 2, 3] } } }, { $project: { itemCount: { $size: "$items" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'count-by-group',
    difficulty: 'easy',
    topics: ['$group'],
    title: 'Count by group',
    prompt: 'Count orders per `status`. Output `{ _id: <status>, count: <n> }`.',
    lesson: 'group-and-sum',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $group: { } }\n])',
    hint: 'The accumulator for counting is { $sum: 1 }.',
    unordered: true,
    solution: 'db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])',
  },
  {
    id: 'several-accumulators',
    difficulty: 'medium',
    topics: ['$group', '$avg', '$min', '$max'],
    title: 'Several accumulators at once',
    prompt:
      'For each `status`, return `count`, `avgDiscount` (average of `discount`), `maxDiscount` and `minDiscount`. Sort by `_id` ascending.',
    lesson: 'accumulators',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $group: {\n    _id: "$status"\n  } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$avg, $max and $min all skip documents where the field is missing.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, avgDiscount: { $avg: "$discount" }, maxDiscount: { $max: "$discount" }, minDiscount: { $min: "$discount" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'revenue-per-product',
    difficulty: 'medium',
    topics: ['$unwind', '$group'],
    title: '$unwind + $group - revenue per product',
    prompt:
      'Total revenue per product across COMPLETED orders only. Revenue for a line item is price x quantity. Output `{ _id: <product>, revenue: <n> }` sorted by revenue descending.\n\nThis shape - explode the array, then group what falls out - is the one most real aggregation work is built on.',
    lesson: 'revenue-per-product',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $unwind: "$items" },\n  { $group: { } },\n  { $sort: { revenue: -1 } }\n])',
    hint: 'After $unwind each document holds ONE item. Use { $multiply: ["$items.price", "$items.quantity"] } - summing price alone is the classic slip.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$items.product", revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { revenue: -1 } }])',
  },
  {
    id: 'distinct-products-per-status',
    difficulty: 'medium',
    topics: ['$unwind', '$group', '$addToSet'],
    title: '$push vs $addToSet inside $group',
    prompt:
      'For each `status`, return two numbers:\n\n- `lineItems`: how many item entries were ordered under that status in total (duplicates counted)\n- `distinctProducts`: how many DIFFERENT products appear under that status\n\nOutput { _id, lineItems, distinctProducts } sorted by `_id` ascending.',
    lesson: 'push-vs-addtoset-in-group',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $unwind: "$items" },\n  { $group: {\n    _id: "$status",\n    lineItems: { $sum: 1 },\n    products: { }\n  } },\n  { $project: { lineItems: 1, distinctProducts: { $size: "$products" } } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$push keeps every value including repeats; $addToSet de-duplicates. Collect with one of them, then take the $size. If your two numbers come out equal, you used the one that keeps duplicates.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $unwind: "$items" }, { $group: { _id: "$status", lineItems: { $sum: 1 }, products: { $addToSet: "$items.product" } } }, { $project: { lineItems: 1, distinctProducts: { $size: "$products" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'top-customers-by-spend',
    difficulty: 'medium',
    topics: ['$unwind', '$group', '$limit'],
    title: 'Top N customers by spend',
    prompt:
      'Find the top 5 users by total spending across completed orders. Output `{ _id: <userId>, totalSpent: <n> }` sorted by totalSpent descending.',
    lesson: 'unwind-plus-group',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $unwind: "$items" },\n  { $group: { } },\n  { $sort: { } },\n  { $limit: 5 }\n])',
    hint: 'Group by "$userId" after unwinding, then sort and limit. $sort must come before $limit.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed" } }, { $unwind: "$items" }, { $group: { _id: "$userId", totalSpent: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } }, { $sort: { totalSpent: -1 } }, { $limit: 5 }])',
  },
  {
    id: 'compound-group-key',
    difficulty: 'medium',
    topics: ['$group'],
    title: 'Group by multiple fields',
    prompt:
      'Count orders grouped by BOTH `userId` and `status`, for users 101, 102 and 103 only. The `_id` must be an object `{ userId, status }`, plus a `count`. Sort by `_id.userId` then `_id.status`, both ascending.',
    lesson: 'compound-group-key',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { userId: { $in: [101, 102, 103] } } },\n  { $group: { _id: { }, count: { $sum: 1 } } },\n  { $sort: { "_id.userId": 1, "_id.status": 1 } }\n])',
    hint: 'The _id can be an object. Its keys together form the composite grouping key.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { userId: { $in: [101, 102, 103] } } }, { $group: { _id: { userId: "$userId", status: "$status" }, count: { $sum: 1 } } }, { $sort: { "_id.userId": 1, "_id.status": 1 } }])',
  },
  {
    id: 'latest-per-user',
    difficulty: 'hard',
    topics: ['$group', '$first', '$sort'],
    title: '$first after sorting - latest order per user',
    prompt:
      'Find the most recent order for each of users 101, 102 and 103. Output `{ _id: <userId>, latestOrderId: <n>, latestDate: <date> }` sorted by `_id` ascending.',
    lesson: 'first-and-last',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { userId: { $in: [101, 102, 103] } } },\n  { $sort: { } },\n  { $group: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: '$first is only meaningful after an explicit $sort - it takes whichever document arrives first in each group.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { userId: { $in: [101, 102, 103] } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$userId", latestOrderId: { $first: "$_id" }, latestDate: { $first: "$createdAt" } } }, { $sort: { _id: 1 } }])',
  },
  {
    id: 'average-per-month',
    difficulty: 'hard',
    topics: ['$group', 'dates', '$map'],
    title: 'Average order value per month',
    prompt:
      'For completed orders placed in 2026, compute the average ORDER value per calendar month. An order value is the sum of price x quantity across all of its items.\n\nOutput `{ _id: <month number>, avgOrderValue: <n> }` sorted by month ascending.',
    lesson: 'date-aggregation',
    starter: 'db.orders.aggregate([\n  \n])',
    scaffold: 'db.orders.aggregate([\n  { $match: { } },\n  { $set: { orderTotal: { } } },\n  { $group: { } },\n  { $sort: { _id: 1 } }\n])',
    hint: 'Compute a per-order total first ($sum over a $map of the items array), then group by { $month: "$createdAt" } and $avg that total. Averaging the line items instead of the order totals is the classic slip.',
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed", createdAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") } } }, { $set: { orderTotal: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.price", "$$i.quantity"] } } } } } }, { $group: { _id: { $month: "$createdAt" }, avgOrderValue: { $avg: "$orderTotal" } } }, { $sort: { _id: 1 } }])',
  },
];
