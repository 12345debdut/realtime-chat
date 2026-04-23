# Privacy notice

This document describes what data the Realtime Chat app collects, why, and how long it's kept. It is a developer-facing reference, not a legal Terms of Service. If you fork this project and ship it to real users under your own brand, replace this file with a jurisdiction-appropriate privacy policy reviewed by counsel.

## Data we store

### Account (required)

| Field | Why | Source |
|---|---|---|
| `handle` | Public username for login and discovery | User-provided at register |
| `displayName` | Shown in chat bubbles and contact lists | User-provided |
| `passwordHash` | argon2id hash (irreversible) — used to verify login | Derived at register |
| `createdAt` | Account age, analytics, data-retention clock | Server-set |

### Account (optional, user-editable)

All blank by default. Users set these in Settings → Personal Information. They can be cleared back to empty.

| Field | Visible to |
|---|---|
| `bio` | Self only (never returned by any non-`/me` endpoint) |
| `email` | Self only |
| `phone` | Self only |
| `dateOfBirth` | Self only |
| `location` | Self only |

The `PublicUserSchema` in `@rtc/contracts` enforces this at the type level — see `packages/contracts/README.md`.

### Privacy preferences

| Flag | Default |
|---|---|
| `readReceiptsEnabled` | `true` |
| `onlineStatusVisible` | `true` |
| `typingIndicatorsEnabled` | `true` |

These are honored bilaterally: if you disable read receipts, you neither send nor receive them.

### Chat data

- Room memberships
- Message bodies (plaintext — end-to-end encryption is not implemented; see `SECURITY.md`)
- Delivery and read state per message
- Message edits and soft-deletes (`deletedAt` is set; the body stays in the DB for 30 days then is hard-deleted by a scheduled job — **TODO: job not yet scheduled**)

### Operational data

- Refresh tokens as `sha256(token)` with `expiresAt` and `revokedAt`
- Socket-level presence (`presence:{userId}` key in Redis, TTL ~30s)
- Pino HTTP logs (rotated at the host level; no request bodies logged)

## Data we do NOT store

- IP addresses (not persisted; only used transiently for rate limits via `@fastify/rate-limit`)
- Advertising identifiers
- Contact-list imports
- Precise location (the `location` field is a free-text user-entered city, not GPS)
- Biometrics

## Third parties

- **Neon** (Postgres hosting) — data at rest, subject to Neon's security controls
- **Upstash** (Redis) — ephemeral presence + privacy cache; no long-lived PII
- **Fly.io** (compute) — process memory only; no durable storage beyond what we ship in code

## Account deletion

Call `DELETE /me` (authenticated). This:

1. Cascades delete of: messages authored, memberships, connections sent/received, pins, tags, refresh tokens.
2. Sets `deletedAt` on the User row (soft-delete first so rooms stay navigable for the other party), then a scheduled job hard-deletes after the 30-day grace period — **TODO: hard-delete job not yet scheduled**.

## Mobile platform notes

If you publish to the iOS App Store or Google Play, you'll need to complete the **App Privacy** / **Data Safety** questionnaires. The truthful answers for this codebase today:

- Identifiers collected: user ID, handle — linked to the user, used for app functionality
- Personal info: email/phone/DOB/location — **only if the user explicitly enters them**; never used for advertising or shared with third parties
- Messages: collected, linked to the user, used for app functionality, not used for advertising, not shared with third parties
- Tracking: **none**

## Changes

Material changes to this document will be announced in the `CHANGELOG.md` and, once the project has real users, via an in-app notice.
