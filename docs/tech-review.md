# Technical Review: Realtime Chat Application

**Reviewer:** Kaushal (Tech Lead)
**Date:** 2026-04-10
**Scope:** Full-stack audit covering server, mobile client, and shared contracts

---

## 1. Critical Bugs

### 1.1 Socket auth token never refreshes after initial connect

**Files:** `apps/mobile/src/foundation/network/socket.ts`

The socket is created with `auth: { token: tokens.accessToken }` at connect time (line 28). This token is baked into the handshake config and never updated. When the access token expires (typically 15-60 minutes), the socket will continue using the stale token. On disconnect + reconnect (which Socket.IO does automatically with `reconnection: true`), the handshake re-sends the same expired token. The server middleware calls `verifyAccess()` which will reject it, causing an infinite reconnect loop that never succeeds.

**Impact:** Every single user will lose realtime messaging after their access token expires and must kill/reopen the app.

**Fix:** Use Socket.IO's `auth` callback form: `auth: (cb) => { cb({ token: await getLatestToken() }) }` so each reconnect attempt fetches the current access token from secure store.

### 1.2 `POST /rooms` bypasses connection checks -- anyone can create a room with anyone

**File:** `apps/server/src/routes/rooms.ts`, lines 44-68

The room creation endpoint accepts arbitrary `memberIds` and creates a room without verifying that the authenticated user has accepted connections with those members. A malicious user can create a DM room with any user ID they know and start sending messages.

**Impact:** Complete bypass of the connection request system. Any user can message any other user without their consent.

**Fix:** For `dm` rooms, reject the endpoint entirely (DMs should only be created via the accept-connection flow). For `group` rooms, validate that all `memberIds` are accepted connections of the requester.

### 1.3 `room:join` socket event has no authorization check

**File:** `apps/server/src/sockets/chat.ts`, lines 98-101

Any authenticated user can join any room's Socket.IO room by emitting `room:join` with an arbitrary `roomId`. There is no membership check. This means a user can eavesdrop on any room's messages, typing indicators, and read receipts.

**Impact:** Complete loss of message privacy. Any user can read every conversation in the system.

**Fix:** Before `socket.join()`, verify that the user has a `Membership` record for the room.

### 1.4 Typing indicators and read receipts have no authorization check

**File:** `apps/server/src/sockets/chat.ts`, lines 180-213

`TypingStart`, `TypingStop`, and `ReadReceipt` events do not verify room membership. Combined with 1.3, a user can update read receipts on rooms they don't belong to, and broadcast typing indicators into arbitrary rooms.

The `ReadReceipt` handler (line 203) calls `prisma.membership.update()` with a composite key `userId_roomId`. This will throw a Prisma `P2025` (Record not found) if the user is not a member, but the error is unhandled -- it will crash silently with no response to the client.

### 1.5 `makeId()` does not produce valid UUIDs -- contract validation will reject them

**File:** `apps/mobile/src/features/chat/data/SyncEngine.ts`, lines 30-45

The `ClientIdSchema` in contracts is `z.string().uuid()` (strict UUID validation). But `makeId()` at line 39 does `h[(Math.random() * 4) | 8]` which is incorrect bitwise logic for the variant nibble. `(Math.random() * 4) | 8` produces integers 8-11 but then indexes into string `h` to get characters `'8'`, `'9'`, `'a'`, `'b'` -- this part actually happens to be correct for UUID v4 variant. However, `(Math.random() * 16) | 0` uses `Math.random()` which has poor entropy and produces collisions at scale. More critically, this function should use `crypto.randomUUID()` from React Native's Hermes engine (available since RN 0.64+) for proper randomness.

**Risk:** At ~10K messages/day, `Math.random()` collision probability is non-trivial. A collision would cause the `upsert` on the server to silently no-op instead of creating a new message, and the user's message vanishes with no error.

---

## 2. Race Conditions

### 2.1 Connection accept is not idempotent -- double-tap creates duplicate rooms

**File:** `apps/server/src/routes/connections.ts`, `acceptRequest()` function

The flow is:
1. `findUnique` the connection request (line 184)
2. Check `status === 'accepted'` (line 188)
3. `$transaction` to update status + create room (line 193)

Between steps 1 and 3, two concurrent accept requests (e.g., user taps twice quickly, or auto-accept from `POST /connections/request` races with manual accept) can both read `status: 'pending'` and both proceed to create a DM room. The `ConnectionRequest` has a `@@unique([senderId, receiverId])` but no unique constraint prevents two rooms with the same pair of members.

**Result:** Duplicate DM rooms for the same pair of users. Messages go to different rooms. The users see different conversations.

**Fix:** Add a unique partial index on `Room` for DM pairs, or use a `SELECT ... FOR UPDATE` inside the transaction, or check-and-create the room with an atomic `upsert`.

### 2.2 Drain fires all pending messages simultaneously without waiting for acks

**File:** `apps/mobile/src/features/chat/data/SyncEngine.ts`, `drain()` method

The drain loop (lines 124-133) fires all pending messages in a tight loop without waiting for acknowledgments. If the server processes them out of order (which Socket.IO does not guarantee under reconnection scenarios), messages appear out of order. Worse, if the socket disconnects mid-drain, some messages are emitted but never acked, and the `draining` flag is reset -- the next drain re-emits them, which is fine thanks to idempotent `upsert`, but the user sees duplicate "pending" rows until the ack arrives.

### 2.3 `onMessageNew` and `onMessageAck` can race on the same message

When the sender sends a message, they receive both `MessageAck` (targeted to their socket) and `MessageNew` (broadcast to the room). These can arrive in either order. If `MessageNew` arrives first, it finds the existing pending row by `clientId` and updates it. Then `MessageAck` arrives and also finds it by `clientId` and updates it again. The second update overwrites `status` to `'sent'` when `MessageNew` already set it to `'delivered'`. This is a minor consistency issue but means the UI may flicker.

### 2.4 Connection re-send after ignore has no transaction protection

**File:** `apps/server/src/routes/connections.ts`, lines 94-103

When an ignored request is re-sent, the code does a non-transactional `update` followed by a `findUnique` with `include`. Between these two calls, another request could have modified the row. The re-send also does not emit a socket notification to the receiver (the `io.to(...).emit(ConnectionRequestNew)` on line 118 is only reached for new creates, not re-sends from the ignored state).

**Result:** Re-sent connection requests after ignore are silently delivered with no realtime notification. The receiver only sees them on next app open/refresh.

---

## 3. Security Issues

### 3.1 No rate limiting anywhere

There are zero rate limits on:
- **Auth endpoints**: Unlimited brute-force on `/auth/login`. An attacker can try millions of passwords.
- **Connection requests**: A user can spam connection requests to every user in the system.
- **Message sending**: A user can flood a room with unlimited messages per second.
- **User search**: No rate limit on `/users?search=` enables user enumeration and scraping the entire user database.

### 3.2 Refresh token rotation has a TOCTOU gap

**File:** `apps/server/src/lib/tokens.ts`, `rotateRefresh()` function

The function does:
1. `findUnique` the token row (line 49)
2. Check `revokedAt` and `expiresAt` (line 53)
3. `update` to set `revokedAt` (line 55)

Two concurrent refresh requests with the same token can both pass step 2 before either executes step 3. Both get valid new token pairs. This breaks refresh token rotation security -- a stolen token can be used to maintain persistent access even after the legitimate user refreshes.

**Fix:** Use an atomic update with a `WHERE revokedAt IS NULL` condition and check the update count.

### 3.3 No input sanitization on message body

Message bodies are stored and returned as-is with a max length of 4000 chars. There is no sanitization for:
- HTML/script injection (if rendered in a WebView component)
- Markdown injection
- Unicode control characters (RTL override, zero-width chars) that can spoof message content

### 3.4 User search returns all users with no pagination cursor

**File:** `apps/server/src/routes/users.ts`

The endpoint returns up to 50 users. With an empty `search` param, it returns the first 50 users alphabetically. By iterating search prefixes (a, b, c, ..., aa, ab, ...), an attacker can enumerate every user in the system. There is no cursor-based pagination, and handles are exposed which are unique identifiers.

### 3.5 `ConnectionRequest.id` is a CUID passed directly as a URL param

**Files:** `apps/server/src/routes/connections.ts`, lines 140, 146

The accept and ignore endpoints use `:id` from the URL with no format validation. While Prisma will handle invalid IDs gracefully (returning null), there is no explicit check that the ID format is valid before hitting the database.

### 3.6 CORS is set to `origin: '*'` on Socket.IO

**File:** `apps/server/src/sockets/chat.ts`, line 58

While this is normal for a mobile-only backend, if there is ever a web client, this enables any website to connect to the socket server with a user's credentials via cross-origin requests.

---

## 4. Missing Edge Cases

### 4.1 User sends connection request to themselves

**Handled.** Line 39 of `connections.ts` checks `receiverId === userId` and returns 400. Good.

### 4.2 Both users request each other simultaneously

**Partially handled.** If user A sends to B, then B sends to A, the code at line 83 detects the existing pending request where B is the receiver, and auto-accepts. However, if both requests are truly concurrent (both `findFirst` queries at line 73 return null because neither `create` has committed yet), both will create `ConnectionRequest` rows. The `@@unique([senderId, receiverId])` constraint means one will fail -- but the error is uncaught and returns a 500 to the user.

**Fix:** Catch the unique constraint violation and retry the logic (it will now find the existing request and auto-accept).

### 4.3 User accepts a request twice

**Handled.** Line 188 checks `status === 'accepted'` and returns 409. But see race condition 2.1 for the concurrent case.

### 4.4 Socket disconnects mid-message-send

**Partially handled.** The message is written locally as `pending` before the socket emit. On reconnect, `drain()` re-emits all pending messages. The server `upsert` on `clientId` makes this idempotent. However, if the server received and processed the message but the ack was lost, the client will re-emit, get a new ack, and the message will be delivered -- but the `MessageNew` broadcast already happened, so other clients already have it. The re-emit will trigger another `MessageNew` broadcast (from `io.to().emit()` on line 169) with the same content. Other clients will upsert by `clientId` so no duplicate, but there is a wasted broadcast.

### 4.5 Token expires during active socket session

**Not handled.** See Critical Bug 1.1. The socket will keep working until it disconnects (server restart, network change, etc.), at which point it can never reconnect.

### 4.6 What happens when a user account is deleted?

**Not handled at all.** There is no account deletion endpoint. But if a user is deleted from the DB:
- `onDelete: Cascade` on `Membership` and `Message` will clean up those.
- `ConnectionRequest` cascades too.
- But other users' WatermelonDB still has the rooms, messages, and connection data. Stale ghost data with no way to clean it up.

### 4.7 Ignored connection requests can be re-sent but the original sender/receiver relationship flips

**File:** `apps/server/src/routes/connections.ts`, line 96

When a request is re-sent after being ignored, the `update` changes `senderId` and `receiverId` to the new values. But the `@@unique([senderId, receiverId])` constraint only covers one direction. The original row was `(A -> B)`. If B re-sends to A, this update changes it to `(B -> A)`, which might conflict with a different row if one exists. This is fragile.

### 4.8 No handling for room with only one member

If a user is deleted (cascade removes their membership), a DM room now has one member. The `/rooms` endpoint will still return it. The remaining user sees a room titled "Chat" (the peer lookup at line 28 of `rooms.ts` returns undefined, fallback to 'Chat'). There is no way to clean this up.

---

## 5. Scalability Concerns

### 5.1 `GET /rooms` is an N+1 query bomb

**File:** `apps/server/src/routes/rooms.ts`, line 13

`findMany` with `include: { memberships: { include: { user: ... } } }` does a join across three tables for every room. At 100K users with hundreds of rooms each, this query becomes catastrophically slow. There is no pagination.

### 5.2 No pagination on room list or connections list

- `GET /rooms` returns ALL rooms for the user (no limit, no cursor).
- `GET /connections` returns ALL accepted connections (no limit, no cursor).
- `GET /connections/pending` returns ALL pending requests (no limit, no cursor).

At 1K+ rooms or connections, these responses become massive and slow.

### 5.3 `userSockets` Map is per-process, not shared across instances

**File:** `apps/server/src/sockets/chat.ts`, line 44

The `userSockets` map is in-memory on each server instance. While the Redis adapter handles cross-instance broadcast for Socket.IO rooms, the `userSockets` map is only used for tracking, so this is not immediately broken. But `getIO().to(\`user:${userId}\`)` relies on Socket.IO rooms which DO work across instances via Redis adapter, so the targeted pushes from REST routes are fine.

However, `markOnline`/`markOffline` (lines 219-224) use a simple Redis `SET`/`DEL`. With multiple sockets per user across instances, `markOffline` on one instance deletes the presence key even though the user is still connected on another instance. **Presence is broken with >1 server instance or >1 device per user.**

### 5.4 `syncFromServer()` fetches all rooms and joins all socket rooms on every reconnect

**File:** `apps/mobile/src/features/chat/data/RoomRepository.ts`, `syncFromServer()`

Every time the socket connects, the client fetches ALL rooms from the server and iterates through ALL local rooms to emit `room:join` for each one. With 500+ rooms, this creates a thundering herd on server reconnects (e.g., after a deploy, every client simultaneously fetches all rooms and joins all socket rooms).

### 5.5 No database connection pooling configuration visible

The Prisma schema uses a single `DATABASE_URL`. At scale, each server instance opens its own connection pool. Without explicit pool sizing (`connection_limit` in the URL), Prisma defaults to `num_cpus * 2 + 1` connections, which can exhaust PostgreSQL's connection limit quickly.

### 5.6 Message pagination uses cursor-based skip

**File:** `apps/server/src/routes/rooms.ts`, line 87

The cursor pagination uses `skip: 1, cursor: { id: req.query.cursor }` which is correct for Prisma cursor-based pagination. This is fine.

---

## 6. Data Integrity

### 6.1 No unique constraint on DM room membership pairs

Two DM rooms can exist between the same two users. The `acceptRequest` function creates a new room every time, and the only guard is the connection request status check, which has a race condition (see 2.1).

### 6.2 `lastMessagePreview` and `lastMessageAt` can drift from actual messages

**File:** `apps/server/src/sockets/chat.ts`, lines 149-155

The room's `lastMessagePreview` is updated separately from the message creation. If the message create succeeds but the room update fails, the preview is stale. These are not in a transaction together (the `upsert` and `room.update` are separate Prisma calls). Under the `upsert` path (retry/idempotent case), the room update still runs, potentially overwriting a newer preview with an older one.

### 6.3 `lastReadMessageId` in Membership is a raw string, not a foreign key

**File:** `apps/server/prisma/schema.prisma`, line 68

`lastReadMessageId` is a `String?` with no foreign key to `Message`. If a message is deleted, this field becomes a dangling reference. Additionally, there is no validation that the referenced message actually belongs to the same room.

### 6.4 ConnectionRequest `@@unique([senderId, receiverId])` is directional

The unique constraint is on `(senderId, receiverId)`, meaning `(A, B)` and `(B, A)` are considered different. The application code handles this by checking both directions in the `OR` query (line 75), but the database itself does not enforce it. A direct database insertion or a bug in the application code could create duplicate cross-directional requests.

### 6.5 Room `memberIds` in response is computed, not stored

The `memberIds` field in the Room contract is computed from `memberships.map(m => m.userId)` at response time. If a membership is added or removed between when the room is fetched and when the response is sent, the data is inconsistent. For the mobile client, `memberIds` is never stored in WatermelonDB at all -- it is lost after the initial sync.

---

## 7. Mobile-Specific Issues

### 7.1 WatermelonDB write lock contention

The `SyncEngine` wraps all operations in `database.write()`. WatermelonDB serializes all writes. If `onMessageNew`, `onMessageAck`, and `onMessageFail` fire in rapid succession (which they will for a burst of messages), they queue up and execute sequentially. A burst of 50 incoming messages means 50 sequential write transactions, each with queries inside. The UI will feel frozen.

**Fix:** Batch multiple message upserts into a single `database.write()` call using `database.batch()`.

### 7.2 Room sync does not delete rooms removed from server

**File:** `apps/mobile/src/features/chat/data/RoomRepository.ts`, `syncFromServer()`

The sync only creates and updates rooms. If a room is deleted on the server (or the user is removed from a room), the local WatermelonDB copy persists forever. The user sees phantom rooms they can no longer interact with.

### 7.3 No message history sync on room open

When a user opens a room, there is no mechanism to fetch messages they missed while offline. The only message sync happens via the socket `message:new` event, which only delivers messages sent while the socket is connected. If the user was offline for 3 hours, they see the last messages from their local DB and nothing in between.

**Fix:** On room open, fetch `/rooms/:id/messages` and reconcile with local WatermelonDB.

### 7.4 `upsertRoom` does not update existing rooms

**File:** `apps/mobile/src/features/chat/data/RoomRepository.ts`, lines 58-73

The `upsertRoom` method (used when a connection is accepted) only creates rooms if they do not exist. If the room already exists locally (e.g., from a previous sync), it silently does nothing. This means updates to room title or other fields from the accept flow are lost.

### 7.5 No cleanup of WatermelonDB on logout

**File:** `apps/mobile/src/features/auth/data/AuthRepository.ts`, `logout()` method

On logout, the code detaches the sync engine and disconnects the socket, but never clears the WatermelonDB database. If another user logs in on the same device, they see the previous user's rooms and messages. This is a **privacy violation**.

**Fix:** Call `database.write(() => database.unsafeResetDatabase())` on logout, or scope the database to the user ID.

### 7.6 Optimistic message uses WatermelonDB `_raw.id` as `clientId`

**File:** `apps/mobile/src/features/chat/data/SyncEngine.ts`, line 95

Setting `m._raw.id = clientId` means the WatermelonDB record's primary key IS the clientId. When the server assigns a `serverId`, the record is updated but the WatermelonDB ID stays as the clientId. This works but means the WatermelonDB ID is not the canonical server ID, which could cause confusion in queries. Any code that queries by WatermelonDB ID expecting a server ID will fail.

---

## 8. Contract Gaps

### 8.1 `ClientIdSchema` requires strict UUID format but `makeId()` uses Math.random

As noted in Critical Bug 1.5, the contract says `z.string().uuid()` but the client generates quasi-random strings. If the Zod validation on the server is strict (which it is -- `C2S_MessageSendSchema` uses `SendMessageInputSchema` which uses `ClientIdSchema`), messages with malformed UUIDs will be rejected with `MessageFail`.

Actually, re-examining `makeId()`: it does produce a string in UUID format (8-4-4-4-12 with hyphens, version 4 nibble, correct variant nibble). The Zod `uuid()` validator accepts any RFC 4122 UUID format. So this will pass validation, but the entropy concern remains.

### 8.2 `GET /rooms/:id/messages` response type is not defined in contracts

The messages endpoint returns an inline-shaped object (lines 89-101 in `rooms.ts`) that mostly matches `MessageSchema`, but `status` is hardcoded to `'delivered'` and the shape is computed inline rather than validated against a contract type.

### 8.3 `POST /rooms` response is not typed against a contract

The room creation response (lines 58-67 of `rooms.ts`) is shaped inline. No contract schema is used for validation.

### 8.4 `GET /rooms` response adds a computed `title` for DMs that is not in the Room contract

Line 26-29 of `rooms.ts` computes a `title` for DM rooms using the peer's display name. This overrides the `null` title from the database. The `RoomSchema` says `title: z.string().min(1).max(120).nullable()`, so a non-null title that is the peer's name is valid, but this transformation is undocumented and only happens on this endpoint.

### 8.5 No contract type for error responses

All error responses (`{ error: 'invalid_body' }`, `{ error: 'handle_taken' }`, etc.) are untyped. The mobile client has no way to discriminate error types at the type level.

### 8.6 `S2C_PresenceSchema` is defined but never emitted by the server

The `S2C_PresenceSchema` and `EventNames.Presence` exist in contracts but the server never emits a `presence` event. The `markOnline`/`markOffline` functions just set Redis keys; no socket event is broadcast. Presence is defined but not implemented.

---

## 9. Recommendations (Prioritized)

### P0 -- Ship Blockers (fix before any user touches this)

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 1 | **Add room membership check to `room:join` socket event** | 1.3 | 30 min |
| 2 | **Add authorization to `POST /rooms` (or disable for `dm` kind)** | 1.2 | 1 hr |
| 3 | **Fix socket token refresh on reconnect** | 1.1 | 1 hr |
| 4 | **Clear WatermelonDB on logout** | 7.5 | 30 min |
| 5 | **Add rate limiting to auth endpoints** (at minimum `/auth/login`) | 3.1 | 2 hr |
| 6 | **Fix refresh token rotation TOCTOU** with atomic conditional update | 3.2 | 1 hr |
| 7 | **Add membership checks to typing and read receipt handlers** | 1.4 | 30 min |

### P1 -- Should Fix Before Launch

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 8 | Prevent duplicate DM rooms (add DB constraint or use SELECT FOR UPDATE) | 2.1, 6.1 | 2 hr |
| 9 | Handle concurrent cross-directional connection requests (catch unique violation, retry) | 4.2 | 1 hr |
| 10 | Add message history fetch on room open | 7.3 | 3 hr |
| 11 | Emit socket notification on re-sent (post-ignore) connection requests | 2.4 | 30 min |
| 12 | Add pagination to `GET /rooms`, `GET /connections`, `GET /connections/pending` | 5.2 | 3 hr |
| 13 | Batch WatermelonDB writes for incoming message bursts | 7.1 | 2 hr |
| 14 | Add rate limiting to message send, connection requests, user search | 3.1 | 2 hr |
| 15 | Fix room sync to handle deletions/removals | 7.2 | 2 hr |
| 16 | Replace `makeId()` with `crypto.randomUUID()` | 1.5 | 15 min |
| 17 | Add `lastReadMessageId` foreign key or validate on write | 6.3 | 1 hr |
| 18 | Wrap message create + room update in a transaction | 6.2 | 30 min |

### P2 -- Nice to Have / Tech Debt

| # | Issue | Section | Effort |
|---|-------|---------|--------|
| 19 | Define contract types for all REST responses (including errors) | 8.2-8.5 | 3 hr |
| 20 | Implement or remove presence feature | 8.6, 5.3 | 4 hr |
| 21 | Add database connection pool configuration | 5.5 | 30 min |
| 22 | Add bidirectional unique constraint for ConnectionRequest pairs | 6.4 | 1 hr |
| 23 | Handle stale/ghost rooms from deleted users | 4.6, 4.8 | 3 hr |
| 24 | Implement incremental room sync (delta instead of full fetch) | 5.4 | 4 hr |
| 25 | Input sanitization for message bodies | 3.3 | 2 hr |
| 26 | Tighten CORS on Socket.IO if web client is planned | 3.6 | 15 min |
| 27 | Fix `upsertRoom` to actually update existing rooms | 7.4 | 30 min |

---

## Summary

The architecture is sound -- shared Zod contracts, optimistic local writes with WatermelonDB, idempotent server upserts, Redis-backed Socket.IO adapter. The foundations are right. But there are several **authorization gaps** (1.2, 1.3, 1.4) that make this unshippable as-is: any authenticated user can read any conversation. The **stale socket token** (1.1) will break every user's session within hours. And the **missing DB reset on logout** (7.5) is a privacy liability.

The race conditions around duplicate DM rooms (2.1) and token rotation (3.2) are the kind of bugs that show up at scale and are painful to debug in production. Fix them now while the data model is still small.

The mobile client needs message history backfill (7.3) and write batching (7.1) to feel production-ready. Without history backfill, any period of offline usage results in permanently missing messages.

Focus on the P0 list first. It is roughly 7 hours of work and addresses the issues that would get you a 1-star review or a security incident.
