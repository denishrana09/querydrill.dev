// Batch 1 - fundamentals: operators, dot notation, arrays, projection, updates.
// Every solution is run live against the seeded `ecommerce` database.

export default [
  {
    id: 'find-with-projection',
    difficulty: 'easy',
    topics: ['find', 'projection'],
    title: 'Equality + projection',
    prompt:
      'Find every user whose status is "active". Return only `name` and `email` - no `_id`.',
    lesson: 'projection',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    hint: 'Second argument to find() is the projection. `_id` is included unless you set it to 0.',
    mistakes: [
      '`{ name: 1, email: 1 }` still returns `_id`. It is the one field that comes back unless you exclude it by name.',
      'Mixing includes and excludes in one projection is an error. `_id` is the only field allowed on both sides.',
    ],
    unordered: true,
    solution: 'db.users.find({ status: "active" }, { _id: 0, name: 1, email: 1 })',
  },
  {
    id: 'range-query',
    difficulty: 'easy',
    topics: ['find', 'comparison'],
    title: 'Range query',
    prompt: 'Find users aged 25 or over but under 40. Return the whole document.',
    lesson: 'comparison-operators',
    starter: 'db.users.find({\n  \n})',
    scaffold: 'db.users.find({\n  age: { }\n})',
    hint: 'Two operators on the same field go in the same object: { $gte: ..., $lt: ... }',
    mistakes: [
      'Two separate `age` keys in the same object are not two conditions. The second replaces the first, so `{ age: { $gte: 25 }, age: { $lt: 40 } }` quietly means only "under 40".',
      '`$gt` is not `$gte`. "25 or over" includes 25, and the difference here is a row.',
    ],
    unordered: true,
    solution: 'db.users.find({ age: { $gte: 25, $lt: 40 } })',
  },
  {
    id: 'match-any-of',
    difficulty: 'easy',
    topics: ['find', '$in'],
    title: '$in',
    prompt: 'Find users whose status is either "active" or "pending". Return `name` and `status`, without `_id`.',
    lesson: 'in-and-nin',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, status: 1 }\n)',
    hint: '$in takes an array of acceptable values.',
    mistakes: [
      '`$in` always takes an array, even for a single value. `{ $in: "active" }` errors.',
    ],
    unordered: true,
    solution:
      'db.users.find({ status: { $in: ["active", "pending"] } }, { _id: 0, name: 1, status: 1 })',
  },
  {
    id: 'nested-field-match',
    difficulty: 'easy',
    topics: ['find', 'nested'],
    title: 'Dot notation into a nested object',
    prompt: 'Find users whose `address.city` is "Bangalore". Return `name` and `address` only, no `_id`.',
    lesson: 'dot-notation',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, address: 1 }\n)',
    hint: 'Quote the path: "address.city".',
    mistakes: [
      '`{ address: { city: "Bangalore" } }` is not a path match. It asks for an address object with exactly one field, so here it matches nothing at all.',
    ],
    unordered: true,
    solution:
      'db.users.find({ "address.city": "Bangalore" }, { _id: 0, name: 1, address: 1 })',
  },
  {
    id: 'array-contains-value',
    difficulty: 'easy',
    topics: ['find', 'arrays'],
    title: 'Array contains a value',
    prompt:
      'Find users who have "MongoDB" in their `skills` array. Return `name` and `skills`, no `_id`.',
    lesson: 'querying-arrays',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, skills: 1 }\n)',
    hint: 'No operator needed. Matching an array field against a scalar checks every element.',
    mistakes: [
      '`{ skills: ["MongoDB"] }` asks for an array equal to `["MongoDB"]`, not one that contains it. Anyone with a second skill drops out.',
    ],
    unordered: true,
    solution: 'db.users.find({ skills: "MongoDB" }, { _id: 0, name: 1, skills: 1 })',
  },
  {
    id: 'array-contains-all',
    difficulty: 'easy',
    topics: ['find', 'arrays', '$all'],
    title: '$all - every value required',
    prompt:
      'Find users who know BOTH "Node.js" and "Kafka". Return `name` and `skills`, no `_id`.',
    lesson: 'querying-arrays',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { skills: { } },\n  { _id: 0, name: 1, skills: 1 }\n)',
    hint: '$in means "any of". You want "all of".',
    mistakes: [
      '`$in` matches either skill, so it returns more users and no error. Nothing on screen says the extra rows are the wrong ones.',
    ],
    unordered: true,
    solution:
      'db.users.find({ skills: { $all: ["Node.js", "Kafka"] } }, { _id: 0, name: 1, skills: 1 })',
  },
  {
    id: 'elemmatch-trap',
    difficulty: 'medium',
    topics: ['find', 'arrays', '$elemMatch'],
    title: 'The $elemMatch trap',
    prompt:
      'Each user has an embedded `orders` array. Find users who have an order that is BOTH product "Laptop" AND status "completed" - in the SAME array element.\n\nReturn `name` and `orders`, no `_id`.',
    lesson: 'elemmatch',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, orders: 1 }\n)',
    hint: 'Multiple conditions that must all hold on the same array element -> $elemMatch.',
    mistakes: [
      '`{ "orders.product": "Laptop", "orders.status": "completed" }` matches a user with some Laptop order and some completed order, not necessarily the same one. It returns 20 users; the answer is 10.',
      '`$elemMatch` wraps the array field, not the path inside it: `{ orders: { $elemMatch: { ... } } }`.',
    ],
    unordered: true,
    solution:
      'db.users.find({ orders: { $elemMatch: { product: "Laptop", status: "completed" } } }, { _id: 0, name: 1, orders: 1 })',
  },
  {
    id: 'and-around-an-or',
    difficulty: 'medium',
    topics: ['find', 'logical', '$or'],
    title: 'Implicit AND wrapping an $or',
    prompt:
      'Find users who are "active" AND (younger than 25 OR have role "admin"). Return `name`, `age`, `role`, `status` - no `_id`.',
    lesson: 'logical-operators',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  {\n    status: "active",\n    $or: [ ]\n  },\n  { _id: 0, name: 1, age: 1, role: 1, status: 1 }\n)',
    hint: 'Top-level fields are ANDed together. Put only the OR branches inside $or.',
    mistakes: [
      'Putting `status` inside the `$or` turns the AND into an OR, and inactive admins start appearing.',
      'Two `$or` keys in one object is one `$or`: the second overwrites the first. Two of them have to be wrapped in `$and`.',
    ],
    unordered: true,
    solution:
      'db.users.find({ status: "active", $or: [{ age: { $lt: 25 } }, { role: "admin" }] }, { _id: 0, name: 1, age: 1, role: 1, status: 1 })',
  },
  {
    id: 'sort-skip-limit',
    difficulty: 'easy',
    topics: ['find', 'sort', 'pagination'],
    title: 'Sort, skip, limit (page 2)',
    prompt:
      'Page through users sorted by `age` descending, then `name` ascending as tie-breaker. Return page 2 with a page size of 5 (so skip 5, take 5). Project `name` and `age`, no `_id`.',
    lesson: 'limit-and-skip',
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users\n  .find({}, { _id: 0, name: 1, age: 1 })\n  .sort({ })\n',
    hint: 'skip = (page - 1) * limit. Order matters: .sort().skip().limit().',
    mistakes: [
      'Sorting by `age` alone leaves people of the same age in an arbitrary order, so a page can repeat or drop a user between two calls. That is what the tie-breaker is for.',
      '`skip(10)` is page 3. The formula is `(page - 1) * limit`.',
    ],
    unordered: false,
    solution:
      'db.users.find({}, { _id: 0, name: 1, age: 1 }).sort({ age: -1, name: 1 }).skip(5).limit(5)',
  },
  {
    id: 'set-nested-field',
    difficulty: 'easy',
    topics: ['update', '$set'],
    type: 'write',
    collections: ['users'],
    title: '$set without clobbering the nested object',
    prompt:
      'Change user 101\'s city to "Bangalore" - and ONLY the city. `address.country` must still be there afterwards.',
    lesson: 'update-and-set',
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { _id: 101 },\n  { $set: { } }\n)',
    hint: 'Set the path "address.city" rather than the field `address`.',
    mistakes: [
      '`$set: { address: { city: "Bangalore" } }` replaces the whole `address` object and takes `address.country` with it. The city is right and the document is damaged.',
      'The `_id` here is the number `101`. Quoting it matches nothing, and `updateOne` reports zero modified rather than failing.',
    ],
    verify: 'db.users.findOne({ _id: 101 }, { _id: 0, name: 1, address: 1 })',
    solution: 'db.users.updateOne({ _id: 101 }, { $set: { "address.city": "Bangalore" } })',
  },
  {
    id: 'guarded-decrement',
    difficulty: 'hard',
    topics: ['update', '$inc', 'atomicity'],
    type: 'write',
    collections: ['products'],
    title: 'Atomic guarded decrement',
    prompt:
      'Reduce `inStock` by 5 for products 1 (Laptop) and 4 (Monitor) - but ONLY where there is enough stock. Laptop currently has 0 in stock, so it must be left untouched; Monitor has 39 and should end at 34.\n\nDo it in a single operation. No read-then-write.',
    lesson: 'atomicity',
    starter: 'db.products.updateMany(\n  { },\n  { }\n)',
    scaffold: 'db.products.updateMany(\n  { _id: { $in: [1, 4] } },\n  { }\n)',
    hint: 'Put the stock condition in the FILTER, not in application code. Then $inc by a negative number.',
    mistakes: [
      '`$inc: { inStock: 5 }` adds. Taking stock away means a negative number.',
      'Reading the stock first and updating after is two operations, and something else can take the last unit in between. The condition has to be in the filter, which is what leaves Laptop at 0 untouched.',
    ],
    unordered: false,
    verify:
      'db.products.find({ _id: { $in: [1, 4] } }, { _id: 1, product: 1, inStock: 1 }).sort({ _id: 1 })',
    solution:
      'db.products.updateMany({ _id: { $in: [1, 4] }, inStock: { $gte: 5 } }, { $inc: { inStock: -5 } })',
  },
  {
    id: 'addtoset-vs-push',
    difficulty: 'easy',
    topics: ['update', 'arrays', '$addToSet'],
    type: 'write',
    collections: ['users'],
    title: '$addToSet vs $push',
    prompt:
      'Add the skill "MongoDB" to users 101 and 104 - without creating a duplicate. User 101 does not have it yet; user 104 already does.',
    lesson: 'array-update-operators',
    starter: 'db.users.updateMany(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateMany(\n  { _id: { $in: [101, 104] } },\n  { }\n)',
    hint: 'One of the array operators adds a value only when it is not already there.',
    mistakes: [
      '`$push` always appends, so user 104 ends up with `"MongoDB"` twice. Both users are reported as modified and nothing looks wrong.',
      '`$set: { skills: ["MongoDB"] }` replaces the array and throws away every other skill.',
    ],
    unordered: false,
    verify:
      'db.users.find({ _id: { $in: [101, 104] } }, { _id: 1, name: 1, skills: 1 }).sort({ _id: 1 })',
    solution:
      'db.users.updateMany({ _id: { $in: [101, 104] } }, { $addToSet: { skills: "MongoDB" } })',
  },
  {
    id: 'positional-update',
    difficulty: 'hard',
    topics: ['update', 'arrays', 'positional'],
    type: 'write',
    collections: ['users'],
    title: 'Positional $ operator',
    prompt:
      'User 101 has an embedded order with `_id: 1012` (a Notebook, currently "pending"). Mark just that one order "completed". Leave the other order alone.',
    lesson: 'positional-operator',
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { _id: 101 },\n  { $set: { } }\n)',
    hint: 'Match the array element in the filter, then use "orders.$.status". The $ refers to the matched element.',
    mistakes: [
      '`"orders.0.status"` hardcodes a position. It works here and breaks the first time the array is in a different order.',
      'The `$` needs the element matched in the filter. Without `"orders._id": 1012` there it has nothing to point at, and the update errors.',
    ],
    verify: 'db.users.findOne({ _id: 101 }, { _id: 0, orders: 1 })',
    solution:
      'db.users.updateOne({ _id: 101, "orders._id": 1012 }, { $set: { "orders.$.status": "completed" } })',
  },
  {
    id: 'upsert-a-document',
    difficulty: 'medium',
    topics: ['update', 'upsert'],
    type: 'write',
    collections: ['users'],
    title: 'Upsert',
    prompt:
      'Insert-or-update a user identified by email "newperson@example.com", setting `name` to "New Person" and `status` to "active". No such user exists yet, so this must create one - in a single call, without checking first.',
    lesson: 'upsert',
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { email: "newperson@example.com" },\n  { $set: { } }\n)',
    hint: 'Third argument: { upsert: true }.',
    mistakes: [
      'Without `upsert`, `updateOne` matches nothing and reports success: zero modified, no error, no document.',
      'The filter is carried into the document it creates, so the new user gets its `email` from `{ email: ... }` without you setting it.',
    ],
    verify:
      'db.users.findOne({ email: "newperson@example.com" }, { _id: 0, name: 1, email: 1, status: 1 })',
    solution:
      'db.users.updateOne({ email: "newperson@example.com" }, { $set: { name: "New Person", status: "active" } }, { upsert: true })',
  },
  {
    id: 'pull-from-array',
    difficulty: 'medium',
    topics: ['update', 'arrays', '$pull'],
    type: 'write',
    collections: ['users'],
    title: '$pull from every document',
    prompt: 'Remove the skill "Kafka" from every user that has it.',
    lesson: 'array-update-operators',
    starter: 'db.users.updateMany(\n  { },\n  { }\n)',
    hint: '$pull removes matching values from an array. An empty filter {} matches everything.',
    mistakes: [
      '`updateOne` stops at the first match. "Every user that has it" means `updateMany`.',
      '`$pop` removes from an end and `$unset` removes the field. `$pull` is the one that removes by value.',
    ],
    unordered: false,
    verify:
      'db.users.find({ _id: { $in: [101, 103] } }, { _id: 1, name: 1, skills: 1 }).sort({ _id: 1 })',
    solution: 'db.users.updateMany({}, { $pull: { skills: "Kafka" } })',
  },
];
