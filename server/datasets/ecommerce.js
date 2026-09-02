// Bigger dataset using the SAME schemas as the notes, so $group / $lookup
// results are actually interesting. Fully deterministic: a seeded PRNG means
// re-seeding always produces byte-identical data.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG = [
  { product: 'Laptop', category: 'Electronics', price: 1000 },
  { product: 'Mouse', category: 'Electronics', price: 50 },
  { product: 'Keyboard', category: 'Electronics', price: 100 },
  { product: 'Monitor', category: 'Electronics', price: 300 },
  { product: 'Headphones', category: 'Audio', price: 150 },
  { product: 'Speaker', category: 'Audio', price: 200 },
  { product: 'Desk Chair', category: 'Furniture', price: 250 },
  { product: 'Standing Desk', category: 'Furniture', price: 600 },
  { product: 'Notebook', category: 'Stationery', price: 5 },
  { product: 'Pen Set', category: 'Stationery', price: 15 },
  { product: 'Backpack', category: 'Accessories', price: 80 },
];

const NAMES = [
  'Denish', 'Aarav', 'Meera', 'Rohan', 'Priya', 'Kabir', 'Ananya', 'Vivaan',
  'Isha', 'Arjun', 'Diya', 'Reyansh', 'Saanvi', 'Aditya', 'Nisha', 'Karan',
  'Tara', 'Yash', 'Riya', 'Manav', 'Sneha', 'Dev', 'Pooja', 'Nikhil',
  'Lakshmi', 'Omar', 'Sara', 'Ethan', 'Chloe', 'Liam',
];

const CITIES = [
  ['Surat', 'India'], ['Bangalore', 'India'], ['Mumbai', 'India'],
  ['Delhi', 'India'], ['Pune', 'India'], ['Ahmedabad', 'India'],
  ['New York', 'USA'], ['Austin', 'USA'], ['London', 'UK'],
  ['Berlin', 'Germany'], ['Toronto', 'Canada'],
];

const SKILLS = [
  'Node.js', 'MongoDB', 'Kafka', 'Redis', 'React',
  'Docker', 'PostgreSQL', 'TypeScript', 'Python', 'AWS',
];

const USER_STATUS = ['active', 'active', 'active', 'pending', 'blocked'];
const ORDER_STATUS = ['completed', 'completed', 'completed', 'pending', 'cancelled'];

const DAY = 86400000;
const EPOCH = Date.UTC(2025, 0, 1); // all dates derive from this fixed point

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const intBetween = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function buildUsers(rand) {
  const users = [];
  for (let i = 0; i < 30; i++) {
    const id = 101 + i;
    const [city, country] = CITIES[i % CITIES.length];

    // Deterministic skill sets. Indices are chosen so that $in, $all and plain
    // array-containment queries each return a different, non-trivial set.
    const skills = [];
    const skillCount = 2 + (i % 3);
    for (let s = 0; s < skillCount; s++) skills.push(SKILLS[(i * 3 + s * 2) % SKILLS.length]);
    const uniqueSkills = [...new Set(skills)];

    // Embedded orders exist so batch1's array drills work on `users`.
    // Three deliberate groups, so the $elemMatch trap actually discriminates:
    //   group 0 -> one element has BOTH Laptop and completed  (matches $elemMatch)
    //   group 1 -> Laptop is pending, Mouse is completed      (matches the NAIVE
    //              query only - this is the group that exposes the bug)
    //   group 2 -> neither
    const group = i % 3;
    let embedded;
    if (group === 0) {
      embedded = [
        { _id: id * 10 + 1, product: 'Laptop', price: 1000, status: 'completed' },
        { _id: id * 10 + 2, product: 'Notebook', price: 5, status: 'pending' },
      ];
    } else if (group === 1) {
      embedded = [
        { _id: id * 10 + 1, product: 'Laptop', price: 1000, status: 'pending' },
        { _id: id * 10 + 2, product: 'Mouse', price: 50, status: 'completed' },
      ];
    } else {
      embedded = [
        { _id: id * 10 + 1, product: 'Keyboard', price: 100, status: 'pending' },
      ];
    }

    users.push({
      _id: id,
      name: NAMES[i],
      email: `${NAMES[i].toLowerCase()}${id}@example.com`,
      age: 21 + ((i * 7) % 25), // 21..45
      country,
      status: USER_STATUS[i % USER_STATUS.length],
      role: i % 8 === 0 ? 'admin' : 'user',
      skills: uniqueSkills,
      address: { city, country },
      orders: embedded,
      createdAt: new Date(EPOCH + i * 9 * DAY),
    });
  }
  return users;
}

function buildOrders(rand) {
  const orders = [];
  for (let n = 1; n <= 200; n++) {
    const userId = 101 + ((n * 7) % 30);
    const itemCount = intBetween(rand, 1, 4);
    const items = [];
    for (let k = 0; k < itemCount; k++) {
      const entry = pick(rand, CATALOG);
      items.push({ ...entry, quantity: intBetween(rand, 1, 3) });
    }

    const order = {
      _id: n,
      userId,
      status: ORDER_STATUS[Math.floor(rand() * ORDER_STATUS.length)],
      // Day is random; time-of-day is a unique function of the order number.
      // 200 orders over 541 days collide often, and MongoDB does not define an
      // order for tied sort keys - so any exercise sorting by createdAt would
      // grade differently run to run. gcd(7, 1440) = 1 and n <= 200 < 1440, so
      // (n * 7) % 1440 is distinct for every order and spreads across the day.
      createdAt: new Date(
        EPOCH + intBetween(rand, 0, 540) * DAY + ((n * 7) % 1440) * 60000
      ), // 2025-01 .. mid-2026
      items,
    };

    // `discount` and `rating` are present on only some orders, on purpose -
    // that is what makes the $ifNull drills meaningful.
    if (rand() < 0.55) order.discount = intBetween(rand, 5, 40);
    if (rand() < 0.5) order.rating = intBetween(rand, 1, 5);

    orders.push(order);
  }
  return orders;
}

export default {
  key: 'ecommerce',
  label: 'ecommerce - 30 users, 200 orders (use this for the exercises)',
  description:
    'Same schemas as the notes, scaled up so $group and $lookup produce real results. Deterministic: re-seeding gives identical data.',
  build() {
    const rand = mulberry32(20260827);
    return {
      users: buildUsers(rand),
      orders: buildOrders(rand),
      products: CATALOG.map((c, i) => ({ _id: i + 1, ...c, inStock: (i * 13) % 40 })),
    };
  },
};
