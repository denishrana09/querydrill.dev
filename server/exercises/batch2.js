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
    mistakes: [
      '`$limit` before `$sort` takes three arbitrary completed orders and then puts those three in date order. Three rows come back either way.',
    ],
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
    mistakes: [
      'Without the `$`, `{ $size: "items" }` is handed the literal string `"items"` instead of the array, and errors.',
    ],
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
    mistakes: [
      '`{ $sum: "$status" }` sums the value of the field. Counting documents is the literal `{ $sum: 1 }`, added once per document.',
      '`$count` is a stage of its own and gives one total for everything, not one per group.',
    ],
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
    mistakes: [
      'Every field beside `_id` in a `$group` has to be an accumulator. `avgDiscount: "$discount"` is not one, and the stage errors.',
      'Reading `avgDiscount` as the average across all orders of that status is wrong: the orders with no `discount` field are skipped, not counted as zero.',
    ],
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
    hint: 'After $unwind each document holds ONE item, so a line total is { $multiply: ["$items.price", "$items.quantity"] }.',
    mistakes: [
      '`$sum: "$items.price"` adds one unit price per line and ignores quantity. Every number is too low and the ranking can still look reasonable.',
      '`$group` before the `$unwind` groups whole orders, so `"$items.product"` is an array of products rather than one product.',
    ],
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
    hint: '$push keeps every value including repeats; $addToSet de-duplicates. Collect with one of them, then take the $size.',
    mistakes: [
      '`$push` keeps duplicates, so `distinctProducts` comes out equal to `lineItems`. Two columns of the same number is the symptom.',
      '`$size` cannot go inside the `$group`. The array has to exist first, so the count belongs in a later stage.',
    ],
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
    hint: 'Group by "$userId" after unwinding, then sort and limit.',
    mistakes: [
      '`$limit` before `$sort` takes five arbitrary users and orders those five. You get five rows and they are the wrong five.',
      '`$sort` on `totalSpent` has to come after the `$group`, because the field does not exist before it.',
    ],
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
    mistakes: [
      'Two `$group` stages, one per field, is not a compound key. The second regroups the output of the first, and the counts stop meaning what you asked for.',
      'After the group there is no `userId` field any more. Sorting by it finds nothing; the path is `"_id.userId"`.',
    ],
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
    mistakes: [
      '`$max: "$createdAt"` and `$max: "$_id"` are worked out independently and can come from two different orders, so the date is right and the id belongs to another one.',
      'A `$sort` after the `$group` sorts the output. `$first` has already chosen by then.',
    ],
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
    hint: 'Compute a per-order total first ($sum over a $map of the items array), then group by { $month: "$createdAt" } and $avg that total.',
    mistakes: [
      'Unwinding and then averaging averages line items, not orders. An order with six cheap items counts six times, and the result still looks like money.',
      'Grouping by `{ $month: ... }` alone merges the same month across years. It is safe here only because the `$match` pins the range to 2026.',
    ],
    unordered: false,
    solution:
      'db.orders.aggregate([{ $match: { status: "completed", createdAt: { $gte: ISODate("2026-01-01"), $lt: ISODate("2027-01-01") } } }, { $set: { orderTotal: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.price", "$$i.quantity"] } } } } } }, { $group: { _id: { $month: "$createdAt" }, avgOrderValue: { $avg: "$orderTotal" } } }, { $sort: { _id: 1 } }])',
  },
];
