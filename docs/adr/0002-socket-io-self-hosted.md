# ADR 0002 — Self-hosted Socket.IO over a managed chat SDK

## Context
Realtime chat needs a persistent, low-latency, bidirectional channel with
presence, typing, and delivery receipts. Options range from managed SDKs
(Stream, Sendbird) to hosted BaaS (Firebase, Supabase Realtime) to rolling
our own WebSocket layer.

The primary goal of this project is to demonstrate engineering depth, so
the calculus is different from shipping to real users quickly.

## Options considered
1. **Stream / Sendbird** — fastest path to a working chat, at the cost of
   hiding the interesting backend work behind an SDK.
2. **Firebase Firestore + FCM** — good realtime on simple data, but the
   offline-first reconciliation story is mostly handled by the SDK. Also
   ties us to Google's wire format.
3. **Supabase Realtime** — Postgres + channels is a pleasant combo, but
   same issue: not enough custom work to show off.
4. **Self-hosted Socket.IO on Fastify with Redis pub/sub adapter.** Full
   control over the wire protocol, reconnection behavior, rate limiting,
   and multi-node scaling story.

## Decision
Self-hosted Socket.IO on a Fastify HTTP server, shared with the REST
surface. Redis adapter is wired in from day one so horizontal scaling is a
deployment concern, not a rewrite.

## Consequences
- We own acks, retries, and idempotency (via `clientId` on every message).
- The `@rtc/contracts` package is shared by client and server, so Zod
  schemas enforce wire compatibility at compile + runtime.
- We carry the cost of rolling our own presence (Redis TTL keys) and
  delivery receipts — but those are exactly the pieces that are fun to
  show.
- Scaling past one node requires the Redis adapter (already wired); sticky
  load balancing is documented in the deploy notes.
