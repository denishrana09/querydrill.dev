---
title: '$inc and counters'
module: 'updating-documents'
track: 'fundamentals'
description: 'MongoDB $inc for atomic counters: increment and decrement a numeric field without reading it first.'
topics: ['update', '$inc']
source: 'batch1.md:682-718'
---

`$inc` adds to a number in place. It matters far more than it looks, because doing the same thing by hand - read, add one, write back - is a race condition waiting for a second process.

```js
db.posts.updateOne(
  { _id: postId },
  {
    $inc: {
      likes: 1
    }
  }
)
```

You do **not** need:

```js
const post = await findPost();

await updatePost({
  likes: post.likes + 1
});
```

That can create race conditions.

Instead:

```js
$inc
```

is atomic at the document level.

## Try it

```js
db.products.updateOne(
  { product: "Laptop" },
  {
    $inc: { inStock: 1 }
  }
)
```

Run it twice. The counter moves both times, and at no point did you read the old value.
