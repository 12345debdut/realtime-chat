# Product Spec: Realtime Chat with Connection Requests

**Version:** 1.0  
**Last Updated:** 2026-04-10  
**Author:** Prakhar (Product)  
**Status:** Draft for Review

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Stories](#2-user-stories)
3. [Screen-by-Screen Breakdown](#3-screen-by-screen-breakdown)
4. [Connection Request Lifecycle](#4-connection-request-lifecycle)
5. [Edge Cases](#5-edge-cases)
6. [Notification & Realtime Events](#6-notification--realtime-events)
7. [Data Model Requirements](#7-data-model-requirements)
8. [User List Filtering Rules](#8-user-list-filtering-rules)
9. [Appendix: Current vs. Target State](#appendix-current-vs-target-state)

---

## 1. Overview

### Product Vision

A lightweight chat app where messaging requires mutual consent. Sending a message to a new person creates a **connection request**, not a direct message. Only after the receiver **accepts** do both parties gain the ability to freely message each other. This prevents spam, makes discovery feel intentional, and keeps the inbox clean.

### Core Principles

- **Consent-first messaging.** No one receives unsolicited messages. The first message is held as a connection request until accepted.
- **No dead ends.** Every user action should feel like it leads somewhere; feedback is instant and clear.
- **Offline-first.** The mobile client works seamlessly offline via WatermelonDB + SyncEngine. Connection state changes sync when connectivity returns.
- **Single source of truth.** The server (PostgreSQL via Prisma) is authoritative. The client is optimistic but defers to server state on conflict.

### Tech Stack (for context)

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Mobile       | React Native, WatermelonDB, Socket.IO client |
| Server       | Node.js, Fastify, Socket.IO, Prisma          |
| Database     | PostgreSQL                                   |
| Cache/Pubsub | Redis                                        |
| Shared Types | `@rtc/contracts` (Zod schemas)               |

---

## 2. User Stories

### Authentication

| #    | Story                                                                                             | Acceptance Criteria                                                    |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| US-1 | As a new user, I can register with a unique handle, display name, and password.                   | Handle must be unique (case-insensitive). Server returns 409 if taken. |
| US-2 | As a returning user, I can log in with my handle and password.                                    | Returns access + refresh token pair. Invalid credentials return 401.   |
| US-3 | As a logged-in user, my session persists until I explicitly log out or the refresh token expires. | Token refresh is transparent to the user.                              |

### Discovery & Connection Requests

| #     | Story                                                                                                         | Acceptance Criteria                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-4  | As a user, I can search for other people by handle or display name.                                           | Results appear after 300ms debounce. Minimum 0 characters (shows suggested users). Max 50 results.                                                                               |
| US-5  | As a user, I do NOT see people I already have a pending request with (sent or received) in search results.    | Server filters these out. See [Section 8](#8-user-list-filtering-rules).                                                                                                         |
| US-6  | As a user, I do NOT see people I am already connected with in search results.                                 | Server filters these out.                                                                                                                                                        |
| US-7  | As a user, I can tap on a person in search results to send them a connection request.                         | Tapping triggers the request. A toast confirms "Request sent to {name}". The user disappears from the list on next refresh.                                                      |
| US-8  | As a user, I can optionally include a short message (max 500 chars) with my connection request.               | The message field is optional. If provided, it is shown to the receiver on the request card and becomes the first message in the DM upon acceptance.                             |
| US-9  | As a user, I can view all connection requests I have **sent** that are still pending.                         | A "Sent" tab/section exists in the Connections screen. Each card shows the receiver's avatar, name, handle, the optional message, and a "Revoke" button.                         |
| US-10 | As a user, I can **revoke** (cancel) a sent connection request at any time before it is accepted.             | Revoking deletes the request. The receiver's pending list updates in realtime. The revoked user reappears in search results for both parties.                                    |
| US-11 | As a user, I receive a realtime notification when someone sends me a connection request.                      | A badge appears on the Connections tab. The request card animates into the pending list if the screen is visible.                                                                |
| US-12 | As a user, I can view all **received** pending connection requests.                                           | The "Received" section in Connections shows each request with sender avatar, name, handle, optional message, and Accept/Ignore buttons.                                          |
| US-13 | As a user, I can **accept** a received connection request.                                                    | Accepting creates a DM room. Both users are navigated (or can navigate) to the new chat. If the request had an initial message, it appears as the first message in the room.     |
| US-14 | As a user, I can **ignore** a received connection request.                                                    | The request disappears from the receiver's list. The sender is NOT notified. The ignored user can re-send a request in the future (the previous ignored request is overwritten). |
| US-15 | As a user, if I send a request to someone who already sent me a request, the connection is **auto-accepted**. | The server detects the mutual intent and creates the DM room immediately. Both users receive the `connection:accepted` event.                                                    |

### Messaging

| #     | Story                                                                                  | Acceptance Criteria                                                                                             |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| US-16 | As a connected user, I can send text messages in a DM room in realtime.                | Messages appear instantly (optimistic) with a pending indicator. Server ack promotes to "sent".                 |
| US-17 | As a connected user, I receive messages in realtime via Socket.IO.                     | New messages appear at the bottom of the chat. The chat list updates with the latest preview.                   |
| US-18 | As a user, I can see a typing indicator when the other person is typing.               | "Typing..." appears below the last message. Disappears after 3 seconds of inactivity or when a message is sent. |
| US-19 | As a user, my messages are stored locally in WatermelonDB and sync when I come online. | Pending messages drain via SyncEngine on reconnect. No duplicate messages after sync.                           |
| US-20 | As a user, I see a list of all my DM rooms sorted by most recent activity.             | The Messages tab shows rooms sorted by `lastMessageAt` descending. Rooms with no messages sort by `createdAt`.  |

### Profile & Settings

| #     | Story                                                                        | Acceptance Criteria                                                                              |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| US-21 | As a user, I can view another user's profile (display name, handle, avatar). | Profile screen is accessible by tapping on a user's avatar/name anywhere in the app.             |
| US-22 | As a user, I can update my display name and avatar.                          | Changes reflect immediately in all rooms and request cards for other users (on next fetch/sync). |
| US-23 | As a user, I can log out.                                                    | Clears local tokens, WatermelonDB data, and disconnects Socket.IO.                               |

---

## 3. Screen-by-Screen Breakdown

### 3.1 Login Screen (`LoginScreen`)

**Purpose:** Authentication entry point for both registration and login.

| State                              | What the user sees                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Default                            | Two text fields (handle, password), a "Log In" button, and a "Create Account" toggle. |
| Loading                            | Button shows spinner, fields are disabled.                                            |
| Error (invalid credentials)        | Inline error text: "Invalid handle or password."                                      |
| Error (network)                    | Inline error text: "Could not connect. Check your internet."                          |
| Error (handle taken, registration) | Inline error text: "That handle is already taken."                                    |
| Success                            | Navigate to MainTabs.                                                                 |

---

### 3.2 Messages Tab (`ChatListScreen`)

**Purpose:** List of all active DM conversations.

| State                      | What the user sees                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty                      | Illustration + "No conversations yet" + "Start a chat" CTA button.                                                                             |
| Populated                  | FlashList of chat rows. Each row: avatar, display name, last message preview (truncated to 1 line), timestamp. Sorted by `lastMessageAt` desc. |
| Loading (initial)          | Skeleton placeholders or spinner.                                                                                                              |
| Pull-to-refresh            | Standard RefreshControl spinner at top.                                                                                                        |
| Error (network on refresh) | Toast: "Could not refresh. Showing cached data."                                                                                               |

**Actions:**

- Tap a row: navigate to `ChatRoom` with `roomId` and `title`.
- Tap FAB (pencil icon) or header "+" button: navigate to `NewChat`.
- Tap search icon in header: _Future — in-chat-list search. Out of scope for v1._

**Badge:** If unread messages exist, the Messages tab icon shows a numeric badge. _(v1: no unread count — deferred to v1.1.)_

---

### 3.3 New Chat Screen (`NewChatScreen`)

**Purpose:** Discover users and initiate connection requests.

| State               | What the user sees                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default (no search) | List of suggested users (all eligible users, paginated to 50).                                                                                                                        |
| Searching           | 300ms debounce, then filtered list. Loading spinner overlays while fetching.                                                                                                          |
| Empty results       | "No users found" centered text.                                                                                                                                                       |
| Sending request     | The tapped row dims (opacity 0.5), a loading toast appears ("Sending request...").                                                                                                    |
| Request sent        | Success toast: "Request sent to {name}". User remains on screen (can send more requests). The user who just received a request should disappear from the list on next search/refresh. |
| Already connected   | App navigates directly to the existing DM room (no toast needed).                                                                                                                     |
| Duplicate request   | Info toast: "Request already sent to {name}".                                                                                                                                         |
| Error               | Error toast: "Failed to send request".                                                                                                                                                |

**Key behavior change (from current):** The user list MUST filter out users who:

- Already have a pending request (in either direction) with the current user
- Already have an accepted connection (DM room exists) with the current user

See [Section 8](#8-user-list-filtering-rules) for the complete filtering spec.

---

### 3.4 Connections Screen (`ConnectionsScreen`)

**Purpose:** Manage incoming and outgoing connection requests.

This screen has **two sections** (implemented as a segmented control or two tabs at the top):

#### 3.4.1 Received Requests Tab

| State                              | What the user sees                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty                              | "No pending requests" + subtext: "When someone sends you a message, their request will appear here."                                                |
| Populated                          | List of request cards. Each card: sender avatar, display name, handle, optional quoted message, Accept button (primary), Ignore button (secondary). |
| Loading                            | Centered spinner.                                                                                                                                   |
| Acting (accept/ignore in progress) | The affected card dims (opacity 0.5). Both buttons are disabled across all cards.                                                                   |
| After accept                       | Card disappears. User navigates to the new ChatRoom.                                                                                                |
| After ignore                       | Card disappears with a subtle fade-out.                                                                                                             |
| Pull-to-refresh                    | Standard RefreshControl.                                                                                                                            |

#### 3.4.2 Sent Requests Tab (NEW)

| State           | What the user sees                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty           | "No sent requests" + subtext: "Requests you send will appear here until they are accepted."                                                                                           |
| Populated       | List of outgoing request cards. Each card: receiver avatar, display name, handle, optional quoted message, "Revoke" button (destructive/red). Timestamp of when the request was sent. |
| Loading         | Centered spinner.                                                                                                                                                                     |
| Revoking        | The affected card dims. Button shows spinner.                                                                                                                                         |
| After revoke    | Card disappears. Optional success toast: "Request to {name} revoked."                                                                                                                 |
| Pull-to-refresh | Standard RefreshControl.                                                                                                                                                              |

**Tab badge:** The Connections bottom tab icon shows a badge count equal to the number of **received** pending requests. This count updates in realtime when `connection:request:new` or `connection:request:revoked` events fire.

---

### 3.5 Chat Room Screen (`ChatRoomScreen`)

**Purpose:** 1:1 messaging within an accepted connection.

| State                         | What the user sees                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Empty (new room, no messages) | "Say hello!" or the initial message from the connection request, if one was included.                                             |
| Populated                     | Messages in chronological order (newest at bottom). Each bubble: body, timestamp, sent/delivered/read indicator for own messages. |
| Loading (fetching history)    | Spinner at top of message list.                                                                                                   |
| Sending                       | Message appears immediately with a clock icon (pending). Transitions to single checkmark (sent) on ack.                           |
| Failed                        | Message shows red retry icon. Tap to retry.                                                                                       |
| Typing indicator              | Animated dots below the last message when the other user is typing.                                                               |
| Offline                       | Banner at top: "You're offline. Messages will be sent when you reconnect." Messages can still be composed and queued locally.     |

**Input bar:** Text input + send button. Send button is disabled when input is empty. Pressing send calls `SyncEngine.enqueueSend()`.

---

### 3.6 Profile Screen (`ProfileScreen`)

**Purpose:** View a user's profile details.

| State                | What the user sees                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Own profile          | Avatar, display name, handle, "Edit Profile" button.                                                                                                                           |
| Other user's profile | Avatar, display name, handle, connection status indicator. If connected: "Message" button. If not connected: "Connect" button. If pending: "Request Pending" (non-actionable). |

---

### 3.7 Settings Screen (`SettingsScreen`)

**Purpose:** App-level settings and account actions.

- Display name and handle (read-only here, edit via Profile)
- Log Out button
- App version
- _Future: notification preferences, theme toggle, blocked users list_

---

## 4. Connection Request Lifecycle

### 4.1 State Machine

```
                                    ┌─────────────────┐
                   User A sends     │                 │
                   request to B     │    PENDING      │
              ┌─────────────────────│                 │
              │                     └────┬───┬───┬────┘
              │                          │   │   │
              │              ┌───────────┘   │   └────────────┐
              │              │               │                │
              │         B accepts       B ignores        A revokes
              │              │               │                │
              │              ▼               ▼                ▼
              │     ┌────────────┐   ┌────────────┐   ┌────────────┐
              │     │  ACCEPTED  │   │  IGNORED   │   │  REVOKED   │
              │     │            │   │            │   │  (deleted) │
              │     └────────────┘   └─────┬──────┘   └────────────┘
              │                            │
              │                     A or B can re-send
              │                     (resets to PENDING)
              │                            │
              │                            ▼
              │                     ┌────────────┐
              └─────────────────────│  PENDING   │
                                    └────────────┘
```

### 4.2 State Definitions

| Status     | Description                                                                                | Who can transition                                                                                        | Next states                                 |
| ---------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `pending`  | Request sent, awaiting response.                                                           | Receiver (accept/ignore), Sender (revoke)                                                                 | `accepted`, `ignored`, or deleted (revoked) |
| `accepted` | Both users are connected. A DM room exists.                                                | Terminal. Cannot be undone via the request system. _(Blocking/unfriending is a separate future feature.)_ | None (terminal)                             |
| `ignored`  | Receiver dismissed the request. Sender is not notified.                                    | Either party can re-initiate (creates a new pending request).                                             | `pending` (via re-send)                     |
| `revoked`  | Sender cancelled before acceptance. The request row is **hard-deleted** from the database. | N/A (row no longer exists)                                                                                | `pending` (via fresh request)               |

### 4.3 What Happens at Each Transition

#### Pending --> Accepted (receiver accepts)

1. Server updates `ConnectionRequest.status` to `accepted`.
2. Server creates a new `Room` (kind: `dm`) with two `Membership` rows.
3. If the request had an initial `message`, a `Message` row is created in the new room and `Room.lastMessagePreview` / `Room.lastMessageAt` are set.
4. Server emits `connection:accepted` to both sender and receiver via Socket.IO (to their user-scoped rooms `user:{userId}`).
5. Both clients upsert the room into WatermelonDB and join the Socket.IO room for the new `roomId`.
6. Receiver's UI navigates to the new ChatRoom.
7. Sender sees the new room appear in their Messages tab on next sync/refresh (or immediately if listening for the socket event).

#### Pending --> Ignored (receiver ignores)

1. Server updates `ConnectionRequest.status` to `ignored`.
2. No socket event is sent to the sender.
3. The request disappears from the receiver's pending list.
4. The sender's sent-requests list will still show the request until the server reflects the change. **Decision:** The server should remove ignored requests from the sender's "sent" list as well, since the sender should not know if they were ignored. The request simply "disappears" for both parties.
5. Both users reappear in each other's search results (because the ignored status is treated as a cleared slate for discovery — see filtering rules).

> **Design rationale for ignore behavior:** We want to avoid a "LinkedIn-style" anxiety loop where senders fixate on whether their request was seen. Ignored requests silently vanish from both sides. The sender may re-send later, which overwrites the ignored record.

#### Pending --> Revoked (sender cancels)

1. Server **hard-deletes** the `ConnectionRequest` row.
2. Server emits `connection:request:revoked` to the receiver via Socket.IO with `{ requestId }`.
3. The request disappears from the receiver's pending list in realtime.
4. The receiver reappears in the sender's search results.
5. The sender reappears in the receiver's search results.

#### Ignored --> Pending (re-send)

1. Either party can send a new request. If the existing row has `status: ignored`, the server resets it:
   - Updates `senderId` to the current sender, `receiverId` to the current receiver.
   - Updates `status` back to `pending`.
   - Updates `message` if provided.
   - Updates `updatedAt`.
2. A fresh `connection:request:new` event is emitted to the new receiver.

### 4.4 Database State Summary

| Scenario                  | `ConnectionRequest` row exists? | `status`   | DM Room exists? |
| ------------------------- | ------------------------------- | ---------- | --------------- |
| No interaction            | No                              | N/A        | No              |
| A sent request to B       | Yes                             | `pending`  | No              |
| B accepted A's request    | Yes                             | `accepted` | Yes             |
| B ignored A's request     | Yes                             | `ignored`  | No              |
| A revoked request to B    | No (deleted)                    | N/A        | No              |
| B ignored, then A re-sent | Yes                             | `pending`  | No              |

---

## 5. Edge Cases

### 5.1 Duplicate Requests

**Scenario:** User A taps "Connect" on User B twice quickly (double-tap, network retry, etc.).

**Behavior:** The server checks for an existing `ConnectionRequest` with `senderId=A, receiverId=B`. If one exists with `status: pending`, the server returns HTTP 409 with `{ error: "request_already_sent" }`. The client silently treats this as success (shows "Request already sent" info toast). No duplicate row is created.

**Current implementation:** Already handled. The `@@unique([senderId, receiverId])` constraint plus the existence check prevents duplicates.

### 5.2 Self-Request

**Scenario:** User A tries to send a connection request to themselves.

**Behavior:** Server returns HTTP 400 with `{ error: "cannot_request_self" }`. The client should never allow this (the user's own profile is excluded from search results), but the server enforces it as a safety net.

**Current implementation:** Already handled.

### 5.3 Mutual Simultaneous Requests

**Scenario:** User A sends a request to User B at the exact same time User B sends a request to User A.

**Behavior:**

1. Whichever request hits the server first creates a `ConnectionRequest` row with `senderId=first, receiverId=second, status=pending`.
2. When the second request arrives, the server finds the existing row where `senderId=second's target, receiverId=second` (i.e., the second user is the receiver of an existing pending request). This triggers **auto-accept**.
3. The server calls the `acceptRequest` flow: creates the DM room, emits `connection:accepted` to both users.
4. Net result: both users are immediately connected with zero wait time.

**Current implementation:** Already handled. The server checks both directions (`OR: [{ senderId: A, receiverId: B }, { senderId: B, receiverId: A }]`) and auto-accepts if the current user is the receiver of a pending request.

### 5.4 Revoking After Accept

**Scenario:** User A tries to revoke a request that User B has already accepted (race condition).

**Behavior:** The revoke endpoint should check the current status. If the request is already `accepted`, return HTTP 409 with `{ error: "already_accepted" }`. The client shows a toast: "This request was already accepted!" and refreshes the connections/rooms list.

**Implementation note:** This is a new endpoint (see Section 7). The server must verify `status === 'pending'` before allowing deletion.

### 5.5 Accepting an Already-Revoked Request

**Scenario:** User B tries to accept a request that User A has already revoked (race condition).

**Behavior:** The accept endpoint looks up the request by ID. Since the row was hard-deleted on revoke, the lookup returns null. Server returns HTTP 404 with `{ error: "not_found" }`. The client removes the stale card from the pending list and shows a toast: "This request is no longer available."

### 5.6 Sending a Request to an Already-Connected User

**Scenario:** User A navigates to NewChat and taps on User B, but they are already connected (perhaps the room was created on another device or while offline).

**Behavior:** The server checks for an existing DM room between the two users. If found, it returns the existing room info with `{ alreadyConnected: true, room: {...} }`. The client navigates directly to the ChatRoom.

**Current implementation:** Already handled.

### 5.7 Offline Request Sending

**Scenario:** User A is offline and taps "Connect" on User B.

**Behavior:** The HTTP POST will fail. The client should:

1. Show an error toast: "You're offline. Try again when connected."
2. Do NOT queue connection requests locally (unlike messages, which are queued in WatermelonDB). Connection requests are not idempotent in the same way and require server-side dedup.

**Rationale:** Messages have a `clientId` idempotency key and a well-defined local-first model in WatermelonDB. Connection requests do not. Keeping request creation online-only avoids complex conflict resolution.

### 5.8 Blocking (Future)

**Scenario:** User A blocks User B.

**Behavior (deferred to v2):**

- Blocked users do not appear in each other's search results.
- Existing DM rooms are hidden (not deleted) from both users.
- Pending connection requests in either direction are auto-rejected.
- Neither user can send new requests to the other.

This is explicitly **out of scope** for v1 but the data model should accommodate it (a `Block` table or a `blocked` status on `ConnectionRequest`).

### 5.9 Ignoring and Re-Sending

**Scenario:** User B ignores User A's request. Later, User A (or User B) wants to connect.

**Behavior:**

- After ignore, both users reappear in each other's search results.
- Either party can send a fresh request. The server overwrites the ignored row (updating sender, receiver, status, and message fields).
- The receiver of the new request sees a fresh request card with no indication that a previous request was ignored.

### 5.10 Account with No Handle Match But Display Name Match

**Scenario:** User searches "John" but the target user's handle is "@jsmith" and display name is "John Smith".

**Behavior:** The search matches on both `handle` and `displayName` using case-insensitive `contains`. "John Smith" would appear in results because `displayName` contains "John".

**Current implementation:** Already handled.

---

## 6. Notification & Realtime Events

### 6.1 Socket.IO Event Catalog

All event names are defined in `@rtc/contracts` `EventNames` constant.

#### Existing Events (no changes needed)

| Event Name               | Direction         | Payload                                                   | When Fired                          | Who Receives                         |
| ------------------------ | ----------------- | --------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `message:send`           | Client --> Server | `{ clientId, roomId, kind, body, mediaUrl?, replyToId? }` | User sends a message                | Server                               |
| `message:new`            | Server --> Client | `{ message: Message }`                                    | A new message is persisted          | All room members except the author   |
| `message:ack`            | Server --> Client | `{ clientId, serverId, createdAt }`                       | Server confirms message receipt     | The message author only              |
| `message:fail`           | Server --> Client | `{ clientId, reason }`                                    | Server rejects a message            | The message author only              |
| `typing:start`           | Client --> Server | `{ roomId }`                                              | User starts typing                  | Server                               |
| `typing:stop`            | Client --> Server | `{ roomId }`                                              | User stops typing                   | Server                               |
| `typing`                 | Server --> Client | `{ roomId, userId, typing }`                              | Typing state changes                | All room members except the typer    |
| `presence`               | Server --> Client | `{ userId, online, lastSeenAt }`                          | User connects/disconnects           | All connected users who share a room |
| `read:receipt`           | Client --> Server | `{ roomId, upToMessageId }`                               | User reads messages                 | Server                               |
| `read:receipt:broadcast` | Server --> Client | `{ roomId, userId, upToMessageId, at }`                   | Read receipt recorded               | All room members except the reader   |
| `connection:request:new` | Server --> Client | `{ request: ConnectionRequestWithUser }`                  | A new connection request is created | The receiver only                    |
| `connection:accepted`    | Server --> Client | `{ requestId, room: Room }`                               | A connection request is accepted    | Both sender and receiver             |

#### New Events (to be added)

| Event Name                   | Direction         | Payload                 | When Fired                       | Who Receives                                    |
| ---------------------------- | ----------------- | ----------------------- | -------------------------------- | ----------------------------------------------- |
| `connection:request:revoked` | Server --> Client | `{ requestId: string }` | Sender revokes a pending request | The receiver only                               |
| `connection:request:ignored` | Server --> Client | `{ requestId: string }` | Receiver ignores a request       | _Not sent_ (by design — sender should not know) |

> **Note on `connection:request:ignored`:** We intentionally do NOT emit this event to the sender. The request simply disappears from the sender's sent list on the next fetch. This prevents the sender from being able to infer that they were ignored in realtime.

### 6.2 Socket Room Membership

Each user auto-joins a personal Socket.IO room named `user:{userId}` on connection. This is used for:

- Delivering connection request events
- Delivering `connection:accepted` events
- Any future user-targeted notifications

When a `connection:accepted` event is received, the client also joins `room:{roomId}` to start receiving messages for the new DM.

### 6.3 Badge Count Updates

The Connections tab badge count must update in realtime:

| Event                                      | Badge Effect                            |
| ------------------------------------------ | --------------------------------------- |
| `connection:request:new` received          | +1                                      |
| User accepts a request                     | -1                                      |
| User ignores a request                     | -1                                      |
| `connection:request:revoked` received      | -1                                      |
| App foregrounded / Connections tab focused | Re-fetch from server to ensure accuracy |

---

## 7. Data Model Requirements

### 7.1 Existing Models (no schema changes needed)

**User** — `id`, `handle` (unique), `displayName`, `avatarUrl`, `passwordHash`, `createdAt`

**Room** — `id`, `kind` (dm/group), `title`, `createdAt`, `updatedAt`, `lastMessagePreview`, `lastMessageAt`

**Membership** — `id`, `userId`, `roomId`, `joinedAt`, `lastReadMessageId`. Unique on `(userId, roomId)`.

**Message** — `id`, `clientId` (unique, idempotency key), `roomId`, `authorId`, `kind`, `body`, `mediaUrl`, `replyToId`, `createdAt`, `editedAt`

**RefreshToken** — `id`, `userId`, `tokenHash`, `expiresAt`, `createdAt`, `revokedAt`

### 7.2 Models Requiring Changes

#### ConnectionRequest (schema change needed)

**Current schema:**

```
id, senderId, receiverId, status (pending | accepted | ignored), message, createdAt, updatedAt
Unique constraint: (senderId, receiverId)
```

**Required change: Add `revoked` status.**

Actually, since revoke is a **hard delete**, no new enum value is needed. The row is simply deleted. However, the unique constraint `@@unique([senderId, receiverId])` needs consideration:

- Currently, the constraint prevents two rows with the same sender-receiver pair.
- Since we overwrite ignored requests (updating sender/receiver/status), and delete revoked requests, a single row per pair is sufficient.
- **No schema change needed.** The existing constraint and statuses are adequate.

**New consideration:** The current unique constraint is `@@unique([senderId, receiverId])`, which means User A can only have ONE request row where A is the sender and B is the receiver. But since we allow role reversal on re-send after ignore (the server swaps senderId/receiverId), there could theoretically be a conflict. The current server code handles this by checking `OR: [{ senderId: A, receiverId: B }, { senderId: B, receiverId: A }]` and updating the existing row in place. This is correct.

### 7.3 New API Endpoints

#### `GET /connections/sent` — List sent pending requests

Returns all connection requests where `senderId = currentUser` and `status = pending`.

**Response shape:**

```typescript
type SentRequest = {
  id: string;
  receiverId: string;
  receiver: User; // avatar, handle, displayName
  message: string | null;
  createdAt: number; // epoch ms
};
```

**Notes:**

- Include `receiver` user data (mirror of how `GET /connections/pending` includes `sender`).
- Order by `createdAt` descending (newest first).

#### `POST /connections/:id/revoke` — Revoke a sent request

**Authorization:** Only the `senderId` of the request can revoke it.

**Preconditions:**

- Request must exist.
- Request `status` must be `pending`.
- `request.senderId` must equal the authenticated user's ID.

**Behavior:**

1. Hard-delete the `ConnectionRequest` row.
2. Emit `connection:request:revoked` to the receiver via Socket.IO.
3. Return `{ success: true }`.

**Error responses:**

- 404: Request not found or caller is not the sender.
- 409: Request is not in `pending` status (already accepted or ignored).

#### `GET /users` — Updated filtering (see Section 8)

The existing `/users` endpoint must be updated to exclude users with pending or accepted connections. See [Section 8](#8-user-list-filtering-rules).

### 7.4 Contract Types to Add (`@rtc/contracts`)

```typescript
// New status or keep existing — no change to ConnectionStatus enum

// Sent requests list response
export const SentConnectionRequestWithUserSchema = ConnectionRequestSchema.extend({
  receiver: UserSchema,
});
export type SentConnectionRequestWithUser = z.infer<typeof SentConnectionRequestWithUserSchema>;

// Revoke response
export const RevokeConnectionResponseSchema = z.object({
  success: z.literal(true),
});
export type RevokeConnectionResponse = z.infer<typeof RevokeConnectionResponseSchema>;

// New socket event
export const S2C_ConnectionRequestRevokedSchema = z.object({
  requestId: IdSchema,
});
export type S2C_ConnectionRequestRevoked = z.infer<typeof S2C_ConnectionRequestRevokedSchema>;
```

Add to `EventNames`:

```typescript
ConnectionRequestRevoked: 'connection:request:revoked',
```

### 7.5 Mobile Repository / Hook Changes

**ConnectionRepository** — Add:

- `getSent(): Promise<SentConnectionRequestWithUser[]>` — calls `GET /connections/sent`
- `revoke(requestId: string): Promise<void>` — calls `POST /connections/:id/revoke`

**useConnections hook** — Expand to manage both received and sent requests:

- `sentRequests` state array
- `revoking` state (like `acting`, but for sent requests)
- `revoke(requestId: string)` callback
- `fetchSent()` function

**SyncEngine** — Add listener for `connection:request:revoked` event to remove the request from local state.

---

## 8. User List Filtering Rules

This is the single most important behavioral spec for preventing a clunky UX. The `GET /users` endpoint (and the NewChat screen) must follow these rules precisely.

### 8.1 Who Should NOT Appear in Search Results

Given the authenticated user (call them "me"), the following users are **excluded**:

| #   | Condition                                                                                                                                    | Reason                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F-1 | `user.id === me.id`                                                                                                                          | Cannot connect with yourself                                                                           |
| F-2 | A `ConnectionRequest` exists where `(senderId=me AND receiverId=user) AND status='pending'`                                                  | I already sent them a request                                                                          |
| F-3 | A `ConnectionRequest` exists where `(senderId=user AND receiverId=me) AND status='pending'`                                                  | They already sent me a request (visible in my Connections tab)                                         |
| F-4 | A `ConnectionRequest` exists where `status='accepted'` and either `(senderId=me AND receiverId=user)` or `(senderId=user AND receiverId=me)` | We are already connected                                                                               |
| F-5 | A DM `Room` exists with both `me` and `user` as members                                                                                      | Safety net: even if the ConnectionRequest is in a weird state, if a DM room exists, they are connected |

### 8.2 Who SHOULD Appear

| #   | Condition                                             | Reason                                             |
| --- | ----------------------------------------------------- | -------------------------------------------------- |
| A-1 | No `ConnectionRequest` exists between me and the user | Fresh — never interacted                           |
| A-2 | A `ConnectionRequest` exists with `status='ignored'`  | Previous request was dismissed; allow re-discovery |

### 8.3 Implementation Approach

The server should perform the filtering in a single efficient query. The recommended approach:

1. Find all user IDs that should be **excluded**:

   ```
   SELECT DISTINCT
     CASE WHEN "senderId" = :myId THEN "receiverId" ELSE "senderId" END as "excludedUserId"
   FROM "ConnectionRequest"
   WHERE ("senderId" = :myId OR "receiverId" = :myId)
     AND "status" IN ('pending', 'accepted')
   ```

2. Also exclude user IDs from existing DM rooms:

   ```
   SELECT DISTINCT m2."userId" as "excludedUserId"
   FROM "Membership" m1
   JOIN "Membership" m2 ON m1."roomId" = m2."roomId"
   JOIN "Room" r ON r.id = m1."roomId"
   WHERE m1."userId" = :myId AND m2."userId" != :myId AND r."kind" = 'dm'
   ```

3. Query users excluding `me.id` + all excluded IDs, applying the search filter.

**In Prisma terms**, this can be done with a subquery via `NOT: { id: { in: excludedIds } }`.

### 8.4 Performance Considerations

- The `@@index([receiverId, status])` on `ConnectionRequest` covers filtering by receiver.
- For the sender side, add an index: `@@index([senderId, status])`.
- The `Membership` table has `@@index([roomId])` which helps the DM-room check.
- For users with many connections (>100), the excluded-IDs list could grow. At scale, consider a materialized "connections" table, but for v1 this approach is fine.

---

## Appendix: Current vs. Target State

### What Already Works

| Feature                           | Status | Notes                                                             |
| --------------------------------- | ------ | ----------------------------------------------------------------- |
| User registration & login         | Done   | Handle + password auth with JWT refresh tokens                    |
| User search by handle/displayName | Done   | Case-insensitive, debounced, 50-result limit                      |
| Send connection request           | Done   | With optional initial message                                     |
| Receive pending requests          | Done   | Listed in Connections screen                                      |
| Accept request (creates DM room)  | Done   | Transaction: update status + create room + optional first message |
| Ignore request                    | Done   | Sets status to `ignored`                                          |
| Auto-accept mutual requests       | Done   | If B sends to A while A has a pending request to B                |
| Realtime request notification     | Done   | `connection:request:new` socket event                             |
| Realtime accept notification      | Done   | `connection:accepted` socket event to both parties                |
| DM messaging via Socket.IO        | Done   | Optimistic writes, ack/fail lifecycle                             |
| Offline message queueing          | Done   | WatermelonDB + SyncEngine drain on reconnect                      |
| Chat list with rooms              | Done   | Sorted by `updatedAt`, FAB to create new chat                     |
| Typing indicators                 | Done   | Socket events + animated dots                                     |
| Presence (online/offline)         | Done   | Socket-level tracking                                             |
| Read receipts                     | Done   | Client --> server --> broadcast                                   |

### What Needs to Be Built

| Feature                                                                    | Priority | Effort Estimate                                                                                          | Dependencies                                                  |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **User list filtering** (exclude pending/accepted connections from search) | P0       | S (server-side query change)                                                                             | None                                                          |
| **Sent requests tab** (view outgoing pending requests)                     | P0       | M (new endpoint + new UI section)                                                                        | New `GET /connections/sent` endpoint                          |
| **Revoke request** (cancel a sent request)                                 | P0       | M (new endpoint + UI + socket event)                                                                     | New `POST /connections/:id/revoke` endpoint, new socket event |
| **Connections screen segmented control** (Received / Sent tabs)            | P0       | S (UI only)                                                                                              | Sent requests endpoint                                        |
| **Remove ignored requests from sender's view**                             | P1       | S (server returns only `pending` for sent list; no extra work if new endpoint already filters by status) | `GET /connections/sent` filtering                             |
| **Realtime badge on Connections tab**                                      | P1       | S (state management for pending count)                                                                   | Socket event listeners                                        |
| **Realtime revoke event handling on receiver**                             | P0       | S (new socket listener + remove card from list)                                                          | `connection:request:revoked` event                            |
| **Index on senderId+status**                                               | P1       | XS (Prisma schema change)                                                                                | None                                                          |

### Out of Scope for V1

- Group chats
- Blocking/reporting users
- Push notifications (APNs/FCM)
- Message editing/deletion
- Media messages (image/file)
- End-to-end encryption
- User profile editing (avatar upload)
- Unread message count / badge on Messages tab
- Message search
- Link previews

---

_End of spec. All questions, edge case discoveries, or design feedback should be discussed in the #product channel before implementation begins._
