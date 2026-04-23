# Backend Architecture Plan

**Author:** Faiyaz (Staff Backend Engineer)  
**Date:** 2026-04-10  
**Status:** Implementation in progress

---

## Change Summary

### P0 -- Ship Blockers

| #   | Change                                                | File(s)                           | Strategy                                                                                                                                                                                                               |
| --- | ----------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Add membership check to `room:join` socket event      | `apps/server/src/sockets/chat.ts` | Query `Membership` by `userId_roomId` before `socket.join()`. Reject silently if not found.                                                                                                                            |
| 2   | Disable `POST /rooms` for `dm` kind                   | `apps/server/src/routes/rooms.ts` | Return 403 if `body.data.kind === 'dm'`. DMs are only created via accept-connection flow.                                                                                                                              |
| 3   | Add membership checks to typing/read receipt handlers | `apps/server/src/sockets/chat.ts` | Query `Membership` before broadcasting typing events. For read receipts, the existing `prisma.membership.update()` already fails on non-members but the error is unhandled -- add a membership check and early return. |
| 4   | Fix refresh token rotation TOCTOU                     | `apps/server/src/lib/tokens.ts`   | Replace find-then-update with atomic `updateMany({ where: { tokenHash, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } })` and check `count > 0`.                                                  |

### P1 -- New Features

| #   | Change                                                           | File(s)                                 | Strategy                                                                                                                                    |
| --- | ---------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | `GET /connections/sent` endpoint                                 | `apps/server/src/routes/connections.ts` | New route returning pending requests where `senderId = currentUser`, include receiver user data.                                            |
| 6   | `POST /connections/:id/revoke` endpoint                          | `apps/server/src/routes/connections.ts` | Hard-delete the request row, emit `connection:request:revoked` to receiver.                                                                 |
| 7   | Update `GET /users` to filter out pending/accepted connections   | `apps/server/src/routes/users.ts`       | Collect excluded user IDs from ConnectionRequest (pending/accepted) and DM room Membership, then use `NOT: { id: { in: excludedIds } }`.    |
| 8   | Emit socket event for re-sent connection requests (after ignore) | `apps/server/src/routes/connections.ts` | Add `io.to().emit(ConnectionRequestNew)` in the ignored-resend branch.                                                                      |
| 9   | Prevent duplicate DM rooms                                       | `apps/server/src/routes/connections.ts` | Add a DM-existence check inside the `$transaction` in `acceptRequest`, using `findFirst` within the transaction for serializable isolation. |

### Contracts Updates

| #   | Change                                                                                                                                                   | File(s)                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 10  | Add `SentConnectionRequestWithUserSchema`, `RevokeConnectionResponseSchema`, `S2C_ConnectionRequestRevokedSchema`, `EventNames.ConnectionRequestRevoked` | `packages/contracts/src/connections.ts`, `packages/contracts/src/events.ts` |

## Database Migration Strategy

**No schema migration needed.** The existing Prisma schema supports all required operations:

- Revoke is a hard delete (no new status enum value).
- The `@@unique([senderId, receiverId])` constraint and existing indexes are sufficient.
- The `@@index([receiverId, status])` index covers receiver-side queries. The `senderId` + `status` queries for `GET /connections/sent` will use the unique index on `(senderId, receiverId)` which is adequate for v1 scale.

## Backwards Compatibility

- The new `GET /connections/sent` and `POST /connections/:id/revoke` endpoints are additive. Existing clients that do not call them are unaffected.
- The `POST /rooms` change to reject `dm` kind is safe because the mobile client never calls this endpoint for DMs (it uses the accept-connection flow).
- The `GET /users` filtering change is a behavioral improvement. Existing clients will simply see fewer (correct) results.
- The new `connection:request:revoked` socket event is additive. Clients that do not listen for it are unaffected (they will see stale data until next fetch).
- All new contract types are additive exports. No existing types are modified.

## Implementation Order

1. Contracts first (new types and event names)
2. P0 security fixes (chat.ts, rooms.ts, tokens.ts)
3. P1 new features (connections.ts, users.ts)
4. Build contracts, typecheck server
