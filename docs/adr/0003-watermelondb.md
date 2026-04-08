# ADR 0003 — WatermelonDB as offline-first source of truth

## Context
A credible chat app has to handle flaky networks. "Optimistic UI plus retry"
is table stakes; the interesting question is *what stores the truth while
you're offline?*

## Options considered
1. **In-memory Zustand store + AsyncStorage rehydration.** Simple but
   doesn't scale past a few hundred messages and has no observable query
   primitives.
2. **Realm.** Fast and observable, but the New Architecture story has been
   turbulent and the license / ownership situation adds risk.
3. **WatermelonDB.** Lazy-loaded SQLite with reactive queries, built
   specifically for large local datasets in React Native. JSI adapter
   available for the New Architecture.
4. **PowerSync / Replicache.** Great, but they assume a specific backend
   shape that conflicts with our bespoke Socket.IO protocol.

## Decision
WatermelonDB with the JSI SQLite adapter. Every screen observes local
tables via `Collection.query().observe()`; the SyncEngine writes to those
tables in response to socket events. The UI never talks to the network
directly.

## Consequences
- A clean one-way data flow: socket → SyncEngine → WatermelonDB → UI.
- Scales to 10k+ messages per room without list jank because WatermelonDB
  only materializes rows on demand.
- Migrations must be handled explicitly via the `migrations/` directory as
  the schema evolves — that's a discipline cost we accept.
- Testing the SyncEngine benefits from a headless Node adapter; we use the
  LokiJS adapter for Jest.
