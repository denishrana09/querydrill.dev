// Batch 1 - fundamentals: operators, dot notation, arrays, projection, updates.
// Every solution is run live against the seeded `ecommerce` database.

export default [
  {
    id: 'b1-01',
    title: 'Equality + projection',
    prompt:
      'Find every user whose status is "active". Return only `name` and `email` - no `_id`.',
    noteRef: { file: 'batch1.md', line: 433, label: 'Batch 1 - Projection' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    hint: 'Second argument to find() is the projection. `_id` is included unless you set it to 0.',
    unordered: true,
    solution: 'db.users.find({ status: "active" }, { _id: 0, name: 1, email: 1 })',
  },
  {
    id: 'b1-02',
    title: 'Range query',
    prompt: 'Find users aged 25 or over but under 40. Return the whole document.',
    noteRef: { file: 'batch1.md', line: 83, label: 'Batch 1 - Comparison Operators' },
    starter: 'db.users.find({\n  \n})',
    scaffold: 'db.users.find({\n  age: { }\n})',
    hint: 'Two operators on the same field go in the same object: { $gte: ..., $lt: ... }',
    unordered: true,
    solution: 'db.users.find({ age: { $gte: 25, $lt: 40 } })',
  },
  {
    id: 'b1-03',
    title: '$in',
    prompt: 'Find users whose status is either "active" or "pending". Return `name` and `status`, without `_id`.',
    noteRef: { file: 'batch1.md', line: 116, label: 'Batch 1 - $in' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, status: 1 }\n)',
    hint: '$in takes an array of acceptable values.',
    unordered: true,
    solution:
      'db.users.find({ status: { $in: ["active", "pending"] } }, { _id: 0, name: 1, status: 1 })',
  },
  {
    id: 'b1-04',
    title: 'Dot notation into a nested object',
    prompt: 'Find users whose `address.city` is "Bangalore". Return `name` and `address` only, no `_id`.',
    noteRef: { file: 'batch1.md', line: 225, label: 'Batch 1 - Nested Objects' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, address: 1 }\n)',
    hint: 'Quote the path: "address.city".',
    unordered: true,
    solution:
      'db.users.find({ "address.city": "Bangalore" }, { _id: 0, name: 1, address: 1 })',
  },
  {
    id: 'b1-05',
    title: 'Array contains a value',
    prompt:
      'Find users who have "MongoDB" in their `skills` array. Return `name` and `skills`, no `_id`.',
    noteRef: { file: 'batch1.md', line: 254, label: 'Batch 1 - Arrays' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, skills: 1 }\n)',
    hint: 'No operator needed. Matching an array field against a scalar checks every element.',
    unordered: true,
    solution: 'db.users.find({ skills: "MongoDB" }, { _id: 0, name: 1, skills: 1 })',
  },
  {
    id: 'b1-06',
    title: '$all - every value required',
    prompt:
      'Find users who know BOTH "Node.js" and "Kafka". Return `name` and `skills`, no `_id`.',
    noteRef: { file: 'batch1.md', line: 305, label: 'Batch 1 - $all' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { skills: { } },\n  { _id: 0, name: 1, skills: 1 }\n)',
    hint: '$in means "any of". You want "all of".',
    unordered: true,
    solution:
      'db.users.find({ skills: { $all: ["Node.js", "Kafka"] } }, { _id: 0, name: 1, skills: 1 })',
  },
  {
    id: 'b1-07',
    title: 'The $elemMatch trap',
    prompt:
      'Each user has an embedded `orders` array. Find users who have an order that is BOTH product "Laptop" AND status "completed" - in the SAME array element.\n\nThe naive version returns 20 users. The correct one returns 10. Getting 20 means two different array elements satisfied your two conditions.\n\nReturn `name` and `orders`, no `_id`.',
    noteRef: { file: 'batch1.md', line: 356, label: 'Batch 1 - Classic MongoDB Trap' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  { },\n  { _id: 0, name: 1, orders: 1 }\n)',
    hint: 'Multiple conditions that must hold on the same array object -> $elemMatch.',
    unordered: true,
    solution:
      'db.users.find({ orders: { $elemMatch: { product: "Laptop", status: "completed" } } }, { _id: 0, name: 1, orders: 1 })',
  },
  {
    id: 'b1-08',
    title: 'Implicit AND wrapping an $or',
    prompt:
      'Find users who are "active" AND (younger than 25 OR have role "admin"). Return `name`, `age`, `role`, `status` - no `_id`.',
    noteRef: { file: 'batch1.md', line: 197, label: 'Batch 1 - interview-style $or example' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users.find(\n  {\n    status: "active",\n    $or: [ ]\n  },\n  { _id: 0, name: 1, age: 1, role: 1, status: 1 }\n)',
    hint: 'Top-level fields are ANDed together. Put only the OR branches inside $or.',
    unordered: true,
    solution:
      'db.users.find({ status: "active", $or: [{ age: { $lt: 25 } }, { role: "admin" }] }, { _id: 0, name: 1, age: 1, role: 1, status: 1 })',
  },
  {
    id: 'b1-09',
    title: 'Sort, skip, limit (page 2)',
    prompt:
      'Page through users sorted by `age` descending, then `name` ascending as tie-breaker. Return page 2 with a page size of 5 (so skip 5, take 5). Project `name` and `age`, no `_id`.',
    noteRef: { file: 'batch1.md', line: 537, label: 'Batch 1 - Limit and Skip' },
    starter: 'db.users.find(\n  { },\n  { }\n)',
    scaffold: 'db.users\n  .find({}, { _id: 0, name: 1, age: 1 })\n  .sort({ })\n',
    hint: 'skip = (page - 1) * limit. Order matters: .sort().skip().limit().',
    unordered: false,
    solution:
      'db.users.find({}, { _id: 0, name: 1, age: 1 }).sort({ age: -1, name: 1 }).skip(5).limit(5)',
  },
  {
    id: 'b1-10',
    type: 'write',
    collections: ['users'],
    title: '$set without clobbering the nested object',
    prompt:
      'Change user 101\'s city to "Bangalore" - and ONLY the city. `address.country` must survive.\n\nThis is the mistake the notes call dangerous: setting the whole `address` object replaces it.',
    noteRef: { file: 'batch1.md', line: 630, label: 'Batch 1 - Dangerous mistake' },
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { _id: 101 },\n  { $set: { } }\n)',
    hint: 'Set "address.city", not `address`.',
    verify: 'db.users.findOne({ _id: 101 }, { _id: 0, name: 1, address: 1 })',
    solution: 'db.users.updateOne({ _id: 101 }, { $set: { "address.city": "Bangalore" } })',
  },
  {
    id: 'b1-11',
    type: 'write',
    collections: ['products'],
    title: 'Atomic guarded decrement',
    prompt:
      'Reduce `inStock` by 5 for products 1 (Laptop) and 4 (Monitor) - but ONLY where there is enough stock. Laptop currently has 0 in stock, so it must be left untouched; Monitor has 39 and should end at 34.\n\nDo it in a single operation. No read-then-write.',
    noteRef: { file: 'batch1.md', line: 944, label: 'Batch 1 - Atomicity' },
    starter: 'db.products.updateMany(\n  { },\n  { }\n)',
    scaffold: 'db.products.updateMany(\n  { _id: { $in: [1, 4] } },\n  { }\n)',
    hint: 'Put the stock condition in the FILTER, not in application code. Then $inc by a negative number.',
    unordered: false,
    verify:
      'db.products.find({ _id: { $in: [1, 4] } }, { _id: 1, product: 1, inStock: 1 }).sort({ _id: 1 })',
    solution:
      'db.products.updateMany({ _id: { $in: [1, 4] }, inStock: { $gte: 5 } }, { $inc: { inStock: -5 } })',
  },
  {
    id: 'b1-12',
    type: 'write',
    collections: ['users'],
    title: '$addToSet vs $push',
    prompt:
      'Add the skill "MongoDB" to users 101 and 104 - without creating a duplicate. User 101 does not have it yet; user 104 already does.\n\nUsing the wrong operator gives user 104 the skill twice.',
    noteRef: { file: 'batch1.md', line: 746, label: 'Batch 1 - Prevent duplicates' },
    starter: 'db.users.updateMany(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateMany(\n  { _id: { $in: [101, 104] } },\n  { }\n)',
    hint: '$push always adds. You want the one that adds only when absent.',
    unordered: false,
    verify:
      'db.users.find({ _id: { $in: [101, 104] } }, { _id: 1, name: 1, skills: 1 }).sort({ _id: 1 })',
    solution:
      'db.users.updateMany({ _id: { $in: [101, 104] } }, { $addToSet: { skills: "MongoDB" } })',
  },
  {
    id: 'b1-13',
    type: 'write',
    collections: ['users'],
    title: 'Positional $ operator',
    prompt:
      'User 101 has an embedded order with `_id: 1012` (a Notebook, currently "pending"). Mark just that one order "completed". Leave the other order alone.',
    noteRef: { file: 'batch1.md', line: 780, label: 'Batch 1 - Updating an Object Inside an Array' },
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { _id: 101 },\n  { $set: { } }\n)',
    hint: 'Match the array element in the filter, then use "orders.$.status". The $ refers to the matched element.',
    verify: 'db.users.findOne({ _id: 101 }, { _id: 0, orders: 1 })',
    solution:
      'db.users.updateOne({ _id: 101, "orders._id": 1012 }, { $set: { "orders.$.status": "completed" } })',
  },
  {
    id: 'b1-14',
    type: 'write',
    collections: ['users'],
    title: 'Upsert',
    prompt:
      'Insert-or-update a user identified by email "newperson@example.com", setting `name` to "New Person" and `status` to "active". No such user exists yet, so this must create one - in a single call, without checking first.',
    noteRef: { file: 'batch1.md', line: 1064, label: 'Batch 1 - Upsert' },
    starter: 'db.users.updateOne(\n  { },\n  { }\n)',
    scaffold: 'db.users.updateOne(\n  { email: "newperson@example.com" },\n  { $set: { } }\n)',
    hint: 'Third argument: { upsert: true }.',
    verify:
      'db.users.findOne({ email: "newperson@example.com" }, { _id: 0, name: 1, email: 1, status: 1 })',
    solution:
      'db.users.updateOne({ email: "newperson@example.com" }, { $set: { name: "New Person", status: "active" } }, { upsert: true })',
  },
  {
    id: 'b1-15',
    type: 'write',
    collections: ['users'],
    title: '$pull from every document',
    prompt: 'Remove the skill "Kafka" from every user that has it.',
    noteRef: { file: 'batch1.md', line: 770, label: 'Batch 1 - Remove from array' },
    starter: 'db.users.updateMany(\n  { },\n  { }\n)',
    hint: '$pull removes matching values from an array. An empty filter {} matches everything.',
    unordered: false,
    verify:
      'db.users.find({ _id: { $in: [101, 103] } }, { _id: 1, name: 1, skills: 1 }).sort({ _id: 1 })',
    solution: 'db.users.updateMany({}, { $pull: { skills: "Kafka" } })',
  },
];
