# ADR 0002 — Bilateral privacy model for read receipts, presence, and typing

- **Status:** Accepted
- **Date:** 2026-04-15
- **Deciders:** Debdut Saha

## Context

The app surfaces three kinds of ambient "someone's paying attention" signals:

- **Read receipts** — "your message has been read"
- **Online presence** — the green dot
- **Typing indicators** — the three bouncing dots

Each is a per-user privacy control. The product decision is not *whether* to let users opt out, but *what opting out means*. Two models exist in the industry:

- **Unilateral** (iMessage, Telegram, Slack): if I turn off read receipts, *you* stop seeing mine; I keep seeing yours.
- **Bilateral** (WhatsApp): if I turn off read receipts, *neither* of us sees them for the other.

Unilateral is friendlier to power users but creates a market for "mark as read without notifying" tricks and breeds the "blue ticks" culture people specifically turn it off to avoid. Bilateral is more symmetric and aligns with the user's mental model: "I don't want this feature in my life."

## Decision

**Use a bilateral privacy model for all three signals.** If either side has the setting disabled, the signal is not exchanged between that pair for that event.

Enforcement lives on the server. The client still persists its own setting in MMKV so actions like typing don't fire at all when the local user has it off — but the server is the final arbiter.

## Consequences

### Positive

- **Symmetric fairness** matches how users reason about privacy: "I turned it off, it's off."
- **No trick surface.** There's no third-party "read without marking read" client trick because the server never broadcasts a read event when either participant has read receipts off.
- **Single source of truth on the server.** Settings are cached in Redis with a 5-minute TTL (`lib/privacyCache.ts`) so per-event lookup is O(1) and doesn't hit Postgres on every typing indicator.

### Negative

- **Per-event lookup cost** — every `message.send` ack path and every typing broadcast reads two users' privacy flags. Redis cache absorbs this; without it, Postgres would be hot-read for nothing.
- **Two sources of truth during migration.** New features like "last seen" need to remember they're bilateral, not unilateral. We've written this in `SECURITY.md` and `packages/contracts/README.md` to make forgetting harder.
- **Cache invalidation** — `PATCH /me/privacy` must invalidate the Redis cache for that user. Missing that would mean settings don't take effect for up to 5 minutes.

## Alternatives rejected

- **Unilateral model.** Rejected on product grounds. Also creates asymmetric server code (the sender's flag controls sending, the receiver's flag is ignored) which is a subtle class of bug.
- **Client-only enforcement.** Rejected because a hostile client could always emit events regardless, making other users' settings a suggestion rather than a guarantee.
- **No caching, read Postgres on every event.** Rejected on latency. At ~20 typing events / sec per active chat, this would put real load on the DB.

## Implementation touchpoints

- `apps/server/src/lib/privacyCache.ts` — Redis-backed getter with 5-min TTL
- `apps/server/src/sockets/chat.ts` — typing, presence, read receipts all gate on `getPrivacy(userId)`
- `apps/server/src/routes/me.ts` — `PATCH /me/privacy` invalidates the cache entry
- `apps/mobile/src/features/privacy/presentation/state/privacyStore.ts` — optimistic toggle with rollback
- `packages/contracts/src/auth.ts` — `PrivacySettingsSchema` + `PrivacySettingsUpdateSchema`

## Notes

When we add a fourth signal (e.g., "last seen"), the PR checklist should include: (1) add flag to `PrivacySettingsSchema`, (2) default to `true`, (3) gate on `getPrivacy` server-side, (4) gate on MMKV flag client-side, (5) include in `PATCH /me/privacy` cache invalidation.
