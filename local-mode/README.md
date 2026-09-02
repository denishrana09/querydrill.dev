# Local mode (deferred)

Runs the exercises against a **real** `mongod` instead of the in-browser engine,
which is what unlocks `explain()`, index tuning, and connecting your own
database. Because it runs on your machine, `mongodb://localhost:27017` means
*your* localhost — which is exactly why this belongs here and not on the hosted
site.

Not buildable yet. `server.js` is the reference implementation carried over from
the original localhost tool. See section 9 of `../ROADMAP.md`.
