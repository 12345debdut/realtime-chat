# Frontend Architecture Plan -- Mobile Client Changes

**Author:** Debdut (Staff Frontend Engineer)
**Date:** 2026-04-10

---

## Scope

This document covers the mobile client changes needed to address P0 ship blockers from the tech review and P1 new features from the product spec. Server-side changes (authorization, rate limiting, etc.) are out of scope for this document.

---

## P0 -- Ship Blockers

### 1. Fix socket token refresh on reconnect (`socket.ts`)

**Problem:** `auth: { token }` bakes a stale token into the Socket.IO config. On reconnect after token expiry, handshake fails forever.

**Fix:** Use Socket.IO's `auth` callback form:

```ts
auth: (cb) => {
  secureStore.load().then((tokens) => cb({ token: tokens?.accessToken ?? '' }));
};
```

This runs on every reconnect attempt, always pulling the latest token from Keychain.

### 2. Clear WatermelonDB on logout (`AuthRepository.ts`)

**Problem:** Logging out leaves the previous user's rooms/messages in WatermelonDB. Next login sees stale data -- a privacy violation.

**Fix:** Call `database.write(() => database.unsafeResetDatabase())` in `logout()` before clearing KV and disconnecting. Make `logout()` async.

### 3. Replace `makeId()` with `crypto.randomUUID()` (`SyncEngine.ts`)

**Problem:** `Math.random()` has poor entropy; collision risk at scale. Hermes supports `crypto.randomUUID()` since RN 0.64+.

**Fix:** Replace `makeId()` with `crypto.randomUUID()`. Add a fallback using the existing implementation for older runtimes, but prefer the native API.

---

## P1 -- New Features

### 4-5. Contract types for sent requests + revoke

**File:** `@rtc/contracts/src/connections.ts`, `@rtc/contracts/src/events.ts`

Add:

- `SentConnectionRequestWithUserSchema` (extends `ConnectionRequestSchema` with `receiver: UserSchema`)
- `RevokeConnectionResponseSchema`
- `S2C_ConnectionRequestRevokedSchema`
- `EventNames.ConnectionRequestRevoked`

### 6. ConnectionRepository: `getSent()` and `revoke()` methods

**File:** `features/connections/data/ConnectionRepository.ts`

- `getSent()` calls `GET /connections/sent`, returns `SentConnectionRequestWithUser[]`
- `revoke(requestId)` calls `POST /connections/:id/revoke`

### 7. useConnections hook expansion

**File:** `features/connections/presentation/hooks/useConnections.ts`

Add:

- `sentRequests` state
- `revoking` state (string | null, like `acting`)
- `fetchSent()` function
- `revoke(requestId)` callback
- `removePendingRequest(requestId)` for socket-driven removal

### 8. ConnectionsScreen: Segmented control (Received / Sent tabs)

**File:** `features/connections/presentation/screens/ConnectionsScreen.tsx`

- Add a segmented control at the top: "Received" | "Sent"
- Received tab: existing UI (pending requests with Accept/Ignore)
- Sent tab: outgoing requests with receiver info + "Revoke" button (destructive red)
- Empty states for each tab per product spec

### 9. SyncEngine: `connection:request:revoked` listener

**File:** `features/chat/data/SyncEngine.ts`

- Listen for `EventNames.ConnectionRequestRevoked`
- Parse payload with `S2C_ConnectionRequestRevokedSchema`
- This is informational for the SyncEngine; the useConnections hook will use the event to remove the request from the received list

### 10. Fix `upsertRoom` to update existing rooms (`RoomRepository.ts`)

**Problem:** `upsertRoom` only creates -- never updates. Room title/preview changes from accept flow are lost.

**Fix:** If the room exists, update its fields.

### 11. Message history backfill on room open

**File:** `features/chat/data/MessageRepository.ts` + `features/chat/presentation/hooks/useChatRoom.ts`

- Add `fetchHistory(roomId)` to MessageRepository that calls `GET /rooms/:id/messages`
- Reconcile with WatermelonDB (upsert by `clientId`, batch writes)
- Call on room open in `useChatRoom`

---

## Dependency Order

```
contracts (4-5) --> socket.ts (1, 8) --> AuthRepository (2) --> SyncEngine (3, 9)
  --> ConnectionRepository (6) --> useConnections (7) --> ConnectionsScreen (8)
  --> RoomRepository (10) --> MessageRepository + useChatRoom (11)
```

All changes are additive or bug fixes. No breaking changes to existing APIs.
