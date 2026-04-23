# ADR 0001 — WatermelonDB as the mobile source of truth

- **Status:** Accepted
- **Date:** 2026-04-08
- **Deciders:** Debdut Saha

## Context

A chat app needs to render thousands of messages, handle optimistic sends, survive app kills, and work offline. The mobile client has four places where chat state could live:

1. **In memory (React state / Zustand).** Fastest, but lost on kill, and refetching on every mount is wasteful.
2. **AsyncStorage / MMKV (key-value).** Persists, but not relational — filtering the last N messages of a room means walking a JSON blob.
3. **SQLite through a raw wrapper (`expo-sqlite`, `react-native-quick-sqlite`).** Full SQL, but hand-rolled ORM/observable plumbing is a lot of code to own.
4. **WatermelonDB.** SQLite under the hood (same perf envelope), plus built-in observables, relations, lazy loading, and a JSI adapter.

We also considered **Realm**. It's fast but carries a heavier native footprint, a stricter schema-migration model, and licensing history that makes some organizations skittish.

## Decision

**Use WatermelonDB as the sole persistent source of truth for chat data on mobile.** Components never `await fetch()` to render — they subscribe to a WatermelonDB query. The network is a side channel that writes into the DB; the UI re-renders because the observable fired.

Ephemeral UI state (keyboard visible, draft text, sheet open) lives in **Zustand**. Cached REST responses that aren't domain data (e.g., "is my token still valid") go through **TanStack Query**. Three stores, zero overlap.

## Consequences

### Positive

- **Offline-first by construction.** If the socket is down, sends go into the outbox; the local DB still has everything to render from.
- **FlashList stays smooth.** Watermelon's lazy loading + SQLite indexes mean opening a 10k-message room is instant.
- **JSI adapter** removes the React-Native bridge from the hot path — property reads on model instances are synchronous.
- **Relational queries** (memberships, pins, tags) are first-class; no N+1 lookups in JS.
- **Observable-driven UI** means no manual "invalidate" calls after a socket write — the affected components re-render automatically.

### Negative

- **Extra native module.** One more thing to keep in sync with RN upgrades. Dependabot ignores `@nozbe/watermelondb` because of this.
- **Learning curve.** Decorators, `@field`, `@relation`, the write-transaction model — non-trivial for a contributor coming from plain SQL.
- **Schema migrations** are more ceremonial than Prisma's — you version the schema and write a migration script that runs at app start.
- **Tests need more scaffolding.** `jest.mock('../foundation/storage', ...)` has to enumerate `collections.*` because Watermelon's Collection is not a drop-in mock target (see `apps/mobile/src/__tests__/RoomRepository.test.ts`).

## Alternatives rejected

- **Refetch on every mount.** Rejected on day one — a chat thread re-fetching 500 messages when the user scrolls back from the settings screen is the opposite of the product thesis.
- **MMKV for chat data.** Rejected — non-relational. Filtering by room + cursor + time would require scanning a JSON blob every render.
- **Realm.** Valid alternative. Rejected primarily on ecosystem weight; Watermelon's JSI adapter and observable integration fit the React mental model better.
- **Zustand with persist middleware as the only store.** Rejected — Zustand is great for ephemeral UI state, but persisting domain data through it means reinventing query caching, pagination, and change propagation.

## Notes

If a future maintainer wants to swap stores, the ports they'd need to replace are:

- `apps/mobile/src/foundation/storage/` — the Watermelon setup, models, and migrations
- `apps/mobile/src/features/chat/data/*Repository.ts` — each repository reads/writes via `collections.*`

Everything above those files reads domain data through observables and is store-agnostic.
