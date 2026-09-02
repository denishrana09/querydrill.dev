// The literal documents quoted in the study notes, so every example in
// batch1.md / batch2.md / batch3.md reproduces verbatim.
//
//   orders  -> batch2.md lines 37-111
//   users   -> batch3.md lines 1364-1370

const orders = [
  {
    _id: 1,
    userId: 101,
    status: 'completed',
    createdAt: new Date('2026-01-10T00:00:00Z'),
    items: [
      { product: 'Laptop', category: 'Electronics', price: 1000, quantity: 1 },
      { product: 'Mouse', category: 'Electronics', price: 50, quantity: 2 },
    ],
  },
  {
    _id: 2,
    userId: 101,
    status: 'completed',
    createdAt: new Date('2026-01-15T00:00:00Z'),
    items: [
      { product: 'Keyboard', category: 'Electronics', price: 100, quantity: 1 },
    ],
  },
  {
    _id: 3,
    userId: 102,
    status: 'completed',
    createdAt: new Date('2026-02-01T00:00:00Z'),
    items: [
      { product: 'Laptop', category: 'Electronics', price: 1000, quantity: 1 },
    ],
  },
  {
    // Note doc 4 deliberately has no createdAt - batch2.md line 97.
    _id: 4,
    userId: 103,
    status: 'pending',
    items: [
      { product: 'Mouse', category: 'Electronics', price: 50, quantity: 1 },
    ],
  },
];

const users = [
  { _id: 101, name: 'Denish', country: 'India' },
  { _id: 102, name: 'Aarav', country: 'India' },
  { _id: 103, name: 'Meera', country: 'USA' },
];

export default {
  key: 'notes',
  label: 'notes - the exact documents from the study notes',
  description:
    'Tiny. The literal orders/users from batch2 and batch3 so you can follow a note section line by line and get identical output.',
  build() {
    return { users, orders };
  },
};
