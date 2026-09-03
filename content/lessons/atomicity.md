---
title: 'Atomicity: why $inc beats read-modify-write'
module: 'updating-documents'
track: 'fundamentals'
description: 'Single-document writes in MongoDB are atomic. What that guarantee covers, what it does not, and how to use it correctly.'
operators: ['$gte', '$inc']
source: 'batch1.md:944-991'
---

This is the interview question behind half the update operators. The guarantee is real but narrower than people assume, and knowing exactly where its edge is separates a confident answer from a hopeful one.

MongoDB guarantees that a **single-document write operation is atomic**.

Example:

```js
db.accounts.updateOne(
  {
    _id: accountId,
    balance: {
      $gte: 100
    }
  },
  {
    $inc: {
      balance: -100
    }
  }
)
```

This is powerful.

Imagine two requests try to withdraw money simultaneously.

Instead of:

```text
1. Read balance
2. Check balance
3. Update balance
```

You combine the condition and update:

```text
balance >= 100
        +
decrement balance by 100
```

in one atomic operation.

That pattern is the standard answer to any interview question about two processes racing for the same document.
