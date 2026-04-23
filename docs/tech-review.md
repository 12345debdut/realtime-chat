# Technical review — known follow-ups

**Origin:** Kaushal (Tech Lead), 2026-04-10. Pruned after a re-audit on the current `main` branch.

---

## How this document has changed

The original 2026-04-10 review listed ~38 items across critical bugs, security issues, and UX gaps. At a re-audit on the current `main`:

- **26 items have shipped** — removed from the body of this doc. See `CHANGELOG.md` for when each landed. A summary is at the bottom.
- **8 items remain open** — listed below as P1/P2 follow-ups.
- **4 items are partially addressed** — fix is in place for the primary concern but the prescribed change differs. Listed under "Partial".

Nothing here is a ship-blocker for the current feature set. These are the next honest engineering pass.

---

## Open — server

### 3.3 No message-body sanitization before persistence

**Files:** `apps/server/src/sockets/chat.ts` (message send handler)

Message bodies are Zod-validated for length + non-empty, but there's no sanitization of control characters, zero-width spaces, or HTML-injection-style payloads. For a pure-text chat app the practical blast radius is small (the mobile client renders as plain text, not HTML), but if a future surface renders message bodies in a web context this becomes XSS.

**Recommended fix:** Strip non-printable control characters on the server write path. Normalize Unicode (NFC). If a web client ever ships, it must escape bodies before injection into the DOM — regardless of this server-side hardening.

### 3.4 User search enumeration risk + missing pagination

**Files:** `apps/server/src/routes/users.ts`

`GET /users?search=` returns up to 50 matches with no cursor. Today the route excludes the caller's existing connections + DM peers, which mitigates casual directory scraping, but a determined scraper can still enumerate by sending many requests with different search prefixes.

**Recommended fix:** Add cursor-based pagination (`?cursor=<id>&limit=<n>`), cap `limit` at 50, and rate-limit the route per-user (60/min — already filed as a spawned follow-up). Consider whether the search endpoint should require _some_ connection to the target before surfacing it; that's a product decision, not an engineering one.

### 3.5 Route-param IDs are not format-validated

**Files:** multiple — e.g. `apps/server/src/routes/connections.ts`, `rooms.ts`, `tags.ts`

Handlers use `req.params.id` directly and pass it to Prisma. Prisma throws on malformed IDs, which lands in the global error handler as a 500. Cosmetic, not a leak (the global error handler now scrubs the response), but inconsistent with the rest of the codebase where every other input is Zod-validated.

**Recommended fix:** A `ParamsSchema = z.object({ id: IdSchema })` per route, `safeParse`d at the top of the handler. 400 on malformed, not 500.

### 4.2 Concurrent cross-directional connection requests

**Files:** `apps/server/src/routes/connections.ts`

If user A sends a request to B at the same moment B sends one to A, both can pass the uniqueness check in memory and race on the `ConnectionRequest` insert. Postgres enforces the uniqueness constraint (`@@unique([senderId, receiverId])`), so one of the two errors out — currently propagating as a 500 to the losing caller.

**Recommended fix:** Catch Prisma's `P2002` (unique violation) in the create path. When it fires, re-read to see if there's a request from the _other_ direction and auto-accept that one, or return a 409 with a "race — retry" envelope. Either is defensible; the status quo (500) is not.

---

## Open — mobile

### 2.2 Outbox drain fires without waiting for acks

**Files:** `apps/mobile/src/features/chat/data/SyncEngine.ts` (around L316)

The drain loop iterates through queued outbox items and emits `message.send` for each in a tight loop. A slow server or a brief socket hiccup mid-drain can duplicate work because the client never pauses to observe acks.

**Recommended fix:** Sequentialize the drain — emit one, await the ack, then the next. The `clientId` idempotency key means a duplicate send is correctness-safe, but we still want to avoid the UX of seeing N pending bubbles that slowly coalesce when the server catches up.

### 2.3 `onMessageNew` / `onMessageAck` ordering race

**Files:** `apps/mobile/src/features/chat/data/SyncEngine.ts` (handlers)

If a `message.new` for your own send arrives before the `message.ack` (plausible when they take different server paths), the local optimistic record and the server echo can both exist momentarily before reconciliation.

**Recommended fix:** An idempotent reconcile path — when either event fires, treat it as "ensure one record exists with both server ID and client ID populated, write the later of the two timestamps". Today the handlers treat them as independent writes.

### 7.1 Per-message `database.write()` during bulk sync

**Files:** `apps/mobile/src/features/chat/data/SyncEngine.ts` and `RoomRepository.ts`

Every synced message opens its own Watermelon write transaction. On a fresh install or a long offline period, this is N round-trips through the JSI bridge for what could be one batch.

**Recommended fix:** Use `database.batch(...)` to prepare all creates + updates, then commit once. Watermelon's `prepareCreate` / `prepareUpdate` helpers exist exactly for this pattern. Measurable win on cold sync of a busy account.

### 7.2 Room deletion not reconciled on sync

**Files:** `apps/mobile/src/features/chat/data/RoomRepository.ts`

`syncFromServer` creates + updates but never deletes. If a room is removed server-side (e.g., the user leaves via a web client), it lingers on mobile until the app is reinstalled.

**Recommended fix:** At the end of the sync loop, diff the set of local rooms with `serverId != null` against the set of server-returned room IDs. Mark any unmatched locals as deleted (soft-delete preferred; cascades to messages).

---

## Partial — addressed differently than originally prescribed

### 1.2 Group-room creation doesn't verify connections

**Original finding:** `POST /rooms` should only accept `memberIds` that are accepted connections of the creator.
**Current state:** DM creation via `POST /rooms` with `kind: 'dm'` is rejected (403) — DMs go through `/connections/:id/accept` only. Group-room creation still accepts arbitrary `memberIds`.
**Status:** Follow-up spawned. Harassment vector, not a data leak.

### 3.1 Rate limiting

**Original finding:** No rate limiting anywhere.
**Current state:** Global 300/min/IP + 10/min/IP on `/auth/*`. Follow-ups spawned for `POST /connections/request` and `GET /users?search=`. Not yet filed: `message.send` socket-event limiting.

### 7.5 WatermelonDB cleanup on logout

**Original finding:** `logout()` should wipe the local DB.
**Current state:** `AuthRepository.finishLogin` wipes the DB when a _different_ user logs in on the same device. `logout()` itself deliberately preserves data for fast re-login of the same user.
**Status:** The privacy concern (user B seeing user A's data) is closed. The prescribed "wipe on logout" would trade a fast-path UX for no additional security — since the new user always triggers a wipe before seeing anything.

### Frontend P0#2 — same as 7.5

Same fix, same trade-off. Closed.

---

## What's shipped (no longer in this document)

High-level summary of the 26 landed items. See `CHANGELOG.md` for per-commit traceability.

- Socket auth token refresh on reconnect (callback form)
- `room:join` + typing + read-receipt membership checks
- Atomic refresh-token rotation (TOCTOU closed)
- `crypto.randomUUID()` replaces `Math.random()` for clientIds
- DM room duplicate prevention inside the accept transaction
- `GET /connections/sent` + `POST /connections/:id/revoke`
- `GET /users` excludes pending/accepted connections + DM peers
- Socket event on re-sent (post-ignore) connection requests
- All P1 contract additions (SentConnectionRequestWithUser, RevokeConnectionResponse, etc.)
- Mobile ConnectionRepository, `useConnections`, segmented-control ConnectionsScreen, SentRequestItem
- Message-history backfill on room open
- `upsertRoom` now updates existing rooms
- Socket.IO CORS scoped to `WEB_ORIGIN`
- Global Fastify error handler (no stack traces leak through 500s)
