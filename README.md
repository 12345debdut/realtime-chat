# Realtime Chat

<!-- badges: update the repo slug once this pushes to GitHub -->
<!-- replace `debdutsaha/realtime-chat` with your own org/repo if you fork -->
[![CI](https://github.com/debdutsaha/realtime-chat/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/debdutsaha/realtime-chat/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node-22-brightgreen)](./.nvmrc)
[![React Native](https://img.shields.io/badge/React_Native-0.85-61dafb)](./apps/mobile)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)](./packages/tsconfig)

An offline-first, realtime 1:1 and group messaging app built end-to-end to demonstrate senior-level craft across **React Native (New Architecture)**, **animations (Reanimated 4 / Worklets)**, **offline sync (WatermelonDB + JSI)**, and a **production-grade backend** on Node.js, Fastify, Socket.IO, and Postgres — deployed to Fly.io.

This is not a toy. Every decision in this repo is deliberate and traceable to a real product concern: latency, reliability on bad networks, data consistency, security, developer ergonomics, and deploy confidence.

## Try it

<!-- Replace these placeholders once you have real URLs. Keep the section here -->
<!-- rather than deleting it — even a "none yet, run locally via §10" entry is -->
<!-- more useful to a reviewer than silence. -->

| Target | Status | Link |
|---|---|---|
| **Server API** | TBD | `https://rtc-chat.fly.dev` (set `RTC_ENV=prod` in Metro to point the mobile app here) |
| **iOS TestFlight** | not yet published | — |
| **Android internal track** | not yet published | — |
| **Web demo** | out of scope for v1 | — |

Until the mobile builds are published, the fastest path to see it running is the [local development](#10-local-development) section — iOS simulator + `yarn workspace @rtc/server dev` gets you there in about 5 minutes.

---

## Table of contents

1. [The product thesis](#1-the-product-thesis)
2. [High-level architecture](#2-high-level-architecture)
3. [Repository layout](#3-repository-layout)
4. [Tech stack and why](#4-tech-stack-and-why)
5. [Offline-first sync engine — how it actually works](#5-offline-first-sync-engine--how-it-actually-works)
6. [Animation system](#6-animation-system)
7. [Backend design](#7-backend-design)
8. [Security model](#8-security-model)
9. [Type safety across the wire](#9-type-safety-across-the-wire)
10. [Local development](#10-local-development)
11. [Deployment](#11-deployment)
12. [Engineering trade-offs I consciously made](#12-engineering-trade-offs-i-consciously-made)
13. [Recently shipped](#13-recently-shipped)
14. [What I'd build next](#14-what-id-build-next)

---

## 1. The product thesis

**Who it's for.** People chatting on flaky networks — commuters, travelers, field workers — where a dropped Wi-Fi handover should never cost a message. The north-star metric is *zero perceived loss*: every message typed must appear in the thread immediately, survive app kills, and reach the other side exactly once.

**The product bets.**

| Bet | Why | How it shows up in the app |
|---|---|---|
| **Optimistic UI is table stakes** | Users blame the app, not the network. Perceived latency beats real latency. | Every send renders instantly with a local ID, then reconciles on server ack. |
| **Local database is the source of truth** | Re-fetching on every mount is slow and wasteful. The UI should read from disk. | WatermelonDB with a JSI SQLite adapter — observables drive the FlashList. |
| **The socket is an optimization, not a dependency** | The app has to work when the socket is gone. | REST + outbox drain as fallback; socket delivers low-latency push when available. |
| **Animation is UX, not polish** | A chat app lives or dies on feel. Swipe-to-reply, bubble entries, typing dots must feel native. | Reanimated 4 worklets, Gesture Handler 2, composed gestures, layout animations. |
| **Type safety spans the network boundary** | The #1 source of bugs in chat apps is drift between client and server schemas. | Shared Zod contracts validated on both ends of the socket. |

---

## 2. High-level architecture

```
 ┌──────────────────────────────────────┐       ┌──────────────────────────────────────────┐
 │           React Native App           │       │              Fastify Server              │
 │        (iOS + Android, 1 codebase)   │       │          (Node.js, Fly.io · Mumbai)       │
 │                                      │       │                                          │
 │   ┌────────────────────────────┐     │       │    ┌─────────────┐    ┌────────────┐     │
 │   │        UI Layer            │     │       │    │  REST API   │    │ Socket.IO  │     │
 │   │  FlashList · Reanimated 4  │     │       │    │  (Fastify)  │    │  gateway   │     │
 │   │  Gesture Handler · RN 0.85 │     │       │    └──────┬──────┘    └─────┬──────┘     │
 │   └──────────────┬─────────────┘     │       │           │                 │            │
 │                  │ observes          │       │           ▼                 ▼            │
 │   ┌──────────────▼─────────────┐     │       │    ┌────────────────────────────┐        │
 │   │     WatermelonDB           │     │       │    │        Zod validators      │        │
 │   │   (SQLite via JSI)         │     │       │    │     (@rtc/contracts)       │        │
 │   │   ← source of truth        │     │       │    └──────────────┬─────────────┘        │
 │   └──────────────┬─────────────┘     │       │                   │                      │
 │                  │ read/write        │       │          ┌────────▼──────────┐           │
 │   ┌──────────────▼─────────────┐     │       │          │   Service layer   │           │
 │   │      Sync Engine           │◄────┼───────┼─────────►│  (domain logic)   │           │
 │   │  · outbox · drain · ack    │     │       │          └────────┬──────────┘           │
 │   │  · idempotent replay       │     │       │                   │                      │
 │   └──────────────┬─────────────┘     │       │          ┌────────▼──────────┐           │
 │                  │                   │       │          │      Prisma       │           │
 │   ┌──────────────▼─────────────┐     │       │          └────────┬──────────┘           │
 │   │   Transport Adapters       │     │       │                   │                      │
 │   │  · axios (REST)            │     │       │                   ▼                      │
 │   │  · socket.io-client (WS)   │     │       │          ┌──────────────────┐            │
 │   └────────────────────────────┘     │       │          │   Postgres       │            │
 │                                      │       │          │   (Neon)         │            │
 └──────────────────┬───────────────────┘       │          └──────────────────┘            │
                    │                           │                                          │
                    │          HTTPS + WSS      │          ┌──────────────────┐            │
                    └───────────────────────────┼─────────►│      Redis       │            │
                                                │          │   (pub/sub fan-  │            │
                                                │          │    out across    │            │
                                                │          │    instances)    │            │
                                                │          └──────────────────┘            │
                                                └──────────────────────────────────────────┘
```

**Three design principles you can point to in any interview:**

1. **The local DB is the UI's only source of truth.** Components never `await fetch()` to render. They observe a WatermelonDB query. Network is a side channel that updates the DB.
2. **Every write is idempotent.** The client generates a UUID `clientId` before sending; the server treats it as the idempotency key. Replaying a send after a crash is safe by construction.
3. **The schema travels with the code.** A single Zod contract is imported by both the mobile app and the server. A breaking change doesn't compile — on either side.

---

## 3. Repository layout

```
realtime-chat/
├── apps/
│   ├── mobile/                 # React Native 0.85 (bare CLI, New Arch on)
│   │   ├── src/
│   │   │   ├── api/            # axios client + typed wrappers
│   │   │   ├── db/             # WatermelonDB schema + models (decorators)
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   └── chat/       # FlashList, MessageBubble, InputBar, TypingDots
│   │   │   ├── sockets/        # socket.io-client wrapper
│   │   │   ├── sync/           # SyncEngine: outbox, drain, ack reconcile
│   │   │   └── state/          # Zustand stores (ephemeral only)
│   │   ├── ios/
│   │   └── android/
│   └── server/                 # Fastify + Socket.IO + Prisma
│       ├── src/
│       │   ├── routes/         # REST endpoints (auth, rooms, messages)
│       │   ├── sockets/        # Socket.IO namespaces + handlers
│       │   ├── lib/            # env, tokens, redis, prisma
│       │   └── middleware/     # auth guard, error envelope
│       ├── prisma/schema.prisma
│       └── Dockerfile
├── packages/
│   ├── contracts/              # Zod schemas shared client ↔ server
│   │   └── src/
│   │       ├── primitives.ts   # branded IDs, ISO timestamps
│   │       ├── auth.ts         # register, login, refresh
│   │       ├── rooms.ts        # dm + group
│   │       ├── messages.ts     # message shape, send payload
│   │       └── events.ts       # socket event catalog
│   └── tsconfig/               # shared strict TS base
├── fly.toml                    # Fly.io config
└── README.md
```

**Why a monorepo.** The contracts package is the single most important file in the codebase — it defines the network boundary. Yarn workspaces let me import the Zod schemas from both `apps/mobile` and `apps/server` with zero duplication, and get compile-time breakage on drift.

---

## 4. Tech stack and why

Every choice here is justified against at least one alternative I rejected.

### Mobile

| Choice | Version | Why this, not the alternative |
|---|---|---|
| **React Native CLI (bare)** | 0.85 | Expo Go is great for prototypes, but we need custom native modules (WatermelonDB's JSI SQLite, Keychain, MMKV) that are friction-heavy on EAS for a senior-level demo. Bare gives me control of `Podfile`, New Arch flags, and the Xcode build graph. |
| **New Architecture** (Fabric, TurboModules, Bridgeless) | on | It's the future and the perf wins are real — synchronous JSI calls mean the WatermelonDB adapter never crosses a bridge. Also shows I can navigate the ecosystem during the transition. |
| **WatermelonDB** | 0.27 | Alternatives: Realm (heavier, licensing friction), SQLite + hand-rolled ORM (too much boilerplate), MMKV/AsyncStorage (not relational). WatermelonDB gives me observables on top of SQLite, lazy column loading, and relations — exactly what a chat thread needs. JSI adapter is the killer feature. |
| **Reanimated 4 + Worklets** | 4.x | Animated API runs on the JS thread and stutters under load. Reanimated runs on the UI thread via worklets. Version 4 aligns with RN 0.85 and moves worklets to their own package (`react-native-worklets`), which is the forward direction. |
| **Gesture Handler** | 2.20 | React Native `PanResponder` is a known source of laggy gestures. GH talks directly to the native gesture system and composes cleanly with Reanimated shared values. |
| **FlashList** (Shopify) | 1.7 | `FlatList` recycles poorly for variable-height content like chat bubbles. FlashList is cell-recycling by default with dramatically lower memory and smoother scrolling. |
| **react-native-keyboard-controller** | 1.14 | The keyboard is the #1 source of jank in chat UIs on both platforms. This library gives me sync keyboard animation on the UI thread, matching the message list offset perfectly. |
| **MMKV** | 3.x | For KV (feature flags, last-seen, ephemeral caches). ~30× faster than AsyncStorage, synchronous, JSI-backed. |
| **Keychain** | 9.x | For refresh tokens. Encrypted at rest, hardware-backed where available. Never in MMKV, never in AsyncStorage. |
| **Zustand** | 5.x | For ephemeral UI state only (keyboard visible, drawer open, draft text). Server state lives in TanStack Query; persistent state lives in WatermelonDB. Three layers, zero overlap. |
| **TanStack Query** | 5.x | Dedupes REST requests, handles retries, and gives me a clean pattern for the `refresh` flow. Does **not** own domain data — that's WatermelonDB's job. |
| **socket.io-client** | 4.x | Native `WebSocket` is primitive. Socket.IO gives me auto-reconnect with backoff, binary support, acks, and namespaces. The overhead is worth it for a real product. |
| **Zod** | 3.x | Runtime validation at the network boundary. Catches schema drift, bad payloads, and malicious clients. Shared between mobile and server. |
| **axios** | 1.x | Interceptors for auth + refresh, cancel tokens for component unmounts. `fetch` works but costs you the interceptor layer. |

### Backend

| Choice | Why |
|---|---|
| **Fastify** | 2–3× faster than Express on throughput benchmarks, with a saner plugin model and first-class TypeScript typings via `FastifyInstance` generics. |
| **Socket.IO (server)** | Same reasoning as client — acks, rooms, Redis adapter for horizontal scale. |
| **Prisma** | Type-safe DB access with generated types. Migrations as code. The alternative (`pg` + hand-rolled queries) is faster to execute but slower to evolve and review. |
| **Postgres (Neon)** | Serverless Postgres with branching. Zero ops overhead, HIPAA-friendly if the product ever needs it, and SQL is still the most portable skill in the industry. |
| **Redis (Upstash)** | Socket.IO's Redis adapter fans out events across Fly machines. Without it, two users connected to different instances wouldn't see each other's messages. |
| **argon2** | For password hashing. bcrypt is still fine but argon2id is the current recommendation and resistant to GPU attacks. |
| **jsonwebtoken + refresh rotation** | Short-lived access tokens (15 min) + rotating refresh tokens (30 days), stored hashed at rest. Stealing a refresh token from the DB is worthless. |
| **Fly.io** | Global edge compute, persistent WebSockets (unlike Netlify/Vercel functions), Docker-native, single-file `fly.toml`. Mumbai region for my latency. |

---

## 5. Offline-first sync engine — how it actually works

This is the part I'm proudest of. It's ~400 lines of TypeScript but it handles:

- Sending while offline
- App kill mid-send
- Duplicate delivery
- Out-of-order ack arrival
- Socket reconnect after hours offline
- Cross-device fan-out

### The shape

```
┌─────────────┐    1. write with     ┌──────────────┐
│  User taps  │──── clientId  ─────► │ WatermelonDB │
│    Send     │                      │    outbox    │
└─────────────┘                      └──────┬───────┘
                                            │
                                 2. drain loop
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │    transport     │
                                  │  (socket first,  │
                                  │   REST fallback) │
                                  └──────┬───────────┘
                                         │
                                 3. server upserts
                                    by clientId
                                         │
                                         ▼
                                  ┌──────────────────┐
                                  │  ack: serverId   │
                                  │    + createdAt   │
                                  └──────┬───────────┘
                                         │
                                 4. reconcile local row
                                    by clientId lookup
                                         │
                                         ▼
                                  ┌──────────────────┐
                                  │  UI observes     │
                                  │  transition to   │
                                  │  "sent"          │
                                  └──────────────────┘
```

### The key invariants

1. **`clientId` is generated on the client** before the row is written. It's a UUIDv4 and becomes the idempotency key.
2. **The server upserts by `clientId`** — `prisma.message.upsert({ where: { clientId } })` — so the same send replayed five times creates one row.
3. **The local row has a `state` column** (`queued` | `sending` | `sent` | `failed`). The drain loop scans `Q.where('state', Q.oneOf(['queued','sending']))` and retries with exponential backoff.
4. **Ack arrives carrying the `clientId`.** The reconcile function looks up the local row by `clientId` and updates it with the server-assigned `serverId` + authoritative `createdAt`. The UI observable re-renders.
5. **Socket `message.new` events** (from other devices) write directly to the local DB with the server's `clientId`. If the row already exists (echo of our own send), it's a no-op. If not, it's a new message from someone else.

### Why this beats naive approaches

| Naive approach | What goes wrong |
|---|---|
| `fetch` on send, update UI on response | Spinner everywhere, perceived latency = network RTT, total failure when offline. |
| Redux + `persistStore` | Serializing the entire state on every write is expensive; relational queries are painful; no observables. |
| Realm Sync | Locks you into MongoDB and a specific pricing model. Harder to reason about conflict resolution. |
| AsyncStorage + custom queue | No transactions, no indexes, no observables — you end up rebuilding WatermelonDB badly. |

See [`apps/mobile/src/sync/SyncEngine.ts`](./apps/mobile/src/sync/SyncEngine.ts).

---

## 6. Animation system

The animations are deliberately **functional, not decorative** — each one communicates state.

| Interaction | Purpose | Tech |
|---|---|---|
| **Bubble entry** (`FadeIn` + `Layout.springify`) | Confirms the message was accepted locally. | Reanimated Layout Animations. |
| **Swipe-to-reply** | Discoverable gesture, matches iMessage/WhatsApp mental model. | `Gesture.Pan()` + `clamp` + `withSpring` + `runOnJS(onReply)` at threshold. |
| **Long-press reactions** | Standard social pattern. | `Gesture.LongPress()` composed with Pan via `Gesture.Simultaneous`. |
| **Typing dots** | Communicates liveness without sending a message. | Three shared values, staggered `withRepeat(withSequence(...))`. |
| **Send button morph** | Press feedback without blocking the UI thread. | `sendProgress` shared value drives opacity + scale in one interpolation. |
| **Keyboard follow** | Input bar tracks the keyboard at 120 Hz. | `react-native-keyboard-controller` on UI thread. |

**Why worklets matter here.** A gesture handler callback on the JS thread adds one frame (16ms) of latency minimum. On the UI thread via `runOnUI`, the gesture can react in under 1ms. That's the difference between "laggy" and "Apple-native feel".

---

## 7. Backend design

### REST surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/register` | argon2 hash, issue access + refresh |
| `POST` | `/auth/login` | verify + issue tokens |
| `POST` | `/auth/refresh` | rotate refresh token, revoke old |
| `GET`  | `/rooms` | list rooms user is a member of |
| `POST` | `/rooms/dm` | create or return existing 1:1 room |
| `POST` | `/rooms/group` | create group with initial members |
| `GET`  | `/rooms/:id/messages` | paginated history, cursor-based |

REST handles history backfill, auth, and room creation. Anything **stateful and realtime** goes through the socket.

### Socket events

```
client → server
  message.send       { clientId, roomId, body, kind }
  message.read       { roomId, upToMessageId }
  typing.start       { roomId }
  typing.stop        { roomId }

server → client
  message.new        { serverId, clientId, roomId, body, senderId, createdAt }
  message.ack        { clientId, serverId, createdAt }
  message.read       { roomId, userId, upToMessageId }
  typing             { roomId, userId, isTyping }
```

Each event is Zod-validated at the edge. Invalid payloads are rejected with a typed error envelope.

### Data model (Prisma)

```
User          id, handle, displayName, avatarUrl, passwordHash, createdAt
              + privacy flags: readReceiptsEnabled, onlineStatusVisible, typingIndicatorsEnabled
              + personal info (optional): bio, email, phone, dateOfBirth, location
Room          id, kind (dm|group), name?, createdAt
Membership    userId, roomId, role, joinedAt, lastReadMessageId
Message       id, clientId @unique, roomId, senderId, body, createdAt
Connection    senderId, receiverId, status (pending|accepted|ignored|blocked)
RefreshToken  id, userId, tokenHash, expiresAt, revokedAt
```

The `clientId @unique` constraint is what makes the upsert safe under concurrent replay.

---

## 8. Security model

| Concern | Mitigation |
|---|---|
| **Password storage** | argon2id with per-user salt. No plaintext, no reversible encryption. |
| **Token theft (device)** | Access token in memory only. Refresh token in Keychain (iOS) / EncryptedSharedPreferences (Android) via `react-native-keychain`. |
| **Token theft (DB)** | Refresh tokens stored as `sha256(token)`. DB dump is useless. |
| **Token replay** | Refresh rotation: every refresh issues a new refresh token and revokes the old. Reuse of a revoked token triggers family revocation. |
| **Socket spoofing** | Every socket connection authenticates via `handshake.auth.token`. Verified server-side before `socket.data.userId` is set. |
| **Schema abuse** | Zod `.strict()` at every edge. Unknown keys are rejected, not silently dropped. |
| **Room authorization** | Every `message.send` checks `Membership.findFirst({ where: { roomId, userId } })`. No membership, no delivery. |
| **Rate limiting** | Fastify `@fastify/rate-limit` on auth endpoints. Per-IP and per-user. |
| **Transport** | HTTPS + WSS end-to-end via Fly's edge. No plaintext anywhere. |
| **User privacy controls** | WhatsApp-style bilateral model: if you disable read receipts, you stop *both* sending and receiving them. Settings are cached in Redis (5-min TTL) so socket handlers check them in O(1) before broadcasting typing, presence, or read events. |
| **Personal info leak prevention** | `PublicUserSchema` omits `bio`, `email`, `phone`, `dateOfBirth`, `location`. Connection/peer responses use `PublicUser`; only `GET /me` returns the full user. Enforced at the schema layer in `@rtc/contracts`. |

**What I deliberately did NOT add** (and why):
- **E2E encryption.** It's a huge project (Signal protocol is ~10kLoC) and out of scope for a demo. I'd use `libsignal` and layer it above the transport.
- **2FA.** Easy to bolt on (`otplib`) but not what this project demonstrates.
- **Device fingerprinting / anomaly detection.** Needs a real threat model.

---

## 9. Type safety across the wire

The `@rtc/contracts` package is the centerpiece of the repo.

```ts
// packages/contracts/src/messages.ts
import { z } from 'zod';
import { UuidV4, RoomId } from './primitives';

export const MessageSendPayload = z.object({
  clientId: UuidV4,         // idempotency key
  roomId:   RoomId,
  body:     z.string().min(1).max(4000),
  kind:     z.enum(['text', 'image', 'file']).default('text'),
}).strict();

export type MessageSendPayload = z.infer<typeof MessageSendPayload>;
```

Both sides consume it the same way:

```ts
// apps/server/src/sockets/chat.ts
import { MessageSendPayload } from '@rtc/contracts';

socket.on('message.send', async (raw: unknown) => {
  const parsed = MessageSendPayload.safeParse(raw);
  if (!parsed.success) return socket.emit('error', toEnvelope(parsed.error));
  // ... parsed.data is fully typed
});
```

```ts
// apps/mobile/src/sockets/chat.ts
import { MessageSendPayload } from '@rtc/contracts';

function sendMessage(payload: MessageSendPayload) {
  MessageSendPayload.parse(payload);   // local validation before send
  socket.emit('message.send', payload);
}
```

A field rename on the server is a compile error on the mobile app on the next `yarn typecheck`. No drift. No staging surprises.

---

## 10. Local development

### Prerequisites
- Node.js **22.11+** (use `nvm`)
- Yarn **3.6.4** (vendored via corepack; no global install needed)
- Xcode 16+ with an iOS 18 simulator
- Ruby 3.3+ (for CocoaPods; install via Homebrew — macOS system Ruby is too old)
- Docker (optional, only if running Postgres locally)

### Bootstrap

```bash
# Install workspace deps
yarn install

# Compile shared contracts (required before server + mobile typecheck)
yarn workspace @rtc/contracts build

# Generate Prisma client
yarn workspace @rtc/server db:generate
```

### Run the server

```bash
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://localhost:6379"
export JWT_ACCESS_SECRET="dev-access-secret"
export JWT_REFRESH_SECRET="dev-refresh-secret"

yarn workspace @rtc/server db:deploy   # run migrations
yarn workspace @rtc/server dev         # tsx watch mode
```

### Run the mobile app

```bash
# Install iOS pods (first time)
cd apps/mobile/ios && bundle install && bundle exec pod install && cd ../..

# Start Metro
yarn workspace @rtc/mobile start --reset-cache

# iOS
yarn workspace @rtc/mobile ios --simulator="iPhone 15 Pro"

# Android
yarn workspace @rtc/mobile android
```

The mobile app honors `RTC_ENV=dev|prod` at Metro start time to flip between `localhost` and the Fly.io URL.

---

## 11. Deployment

The server is Dockerized and ships to Fly.io.

```bash
# One-time: create the app
fly apps create rtc-chat

# Set secrets
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  JWT_ACCESS_SECRET="..." \
  JWT_REFRESH_SECRET="..."

# Deploy
fly deploy
```

### Key deployment lessons from building this

1. **Never ship an incremental `.tsbuildinfo` in a Docker image.** If `.dockerignore` only excludes `dist/` but `incremental: true` puts `.tsbuildinfo` next to `tsconfig.json`, tsc in the build stage reads it, decides "nothing changed", and skips emit. The image ships with zero compiled code and crashes at `node dist/index.js`. Fixed by excluding `**/*.tsbuildinfo` and pinning `tsBuildInfoFile` inside `dist/`.
2. **Compile shared workspaces before the app.** The server's `Dockerfile` runs `yarn build` in `packages/contracts` **before** running it in `apps/server`, because the server's runtime `require('@rtc/contracts')` resolves to the built `dist/index.js` — which has to exist.
3. **Use `auto_stop_machines = "off"` + `min_machines_running = 1`** for a WebSocket server. Fly's default is to scale to zero, which kills long-lived socket connections.
4. **Pin the primary region close to your users.** I use `bom` (Mumbai). The deprecated `bos` region taught me this the hard way.

---

## 12. Engineering trade-offs I consciously made

A senior engineer can defend every choice **and** name what they gave up.

| Trade-off | What I gave up | Why it was worth it |
|---|---|---|
| **WatermelonDB over a simple SQLite wrapper** | Extra native module, more complex schema migrations | Observables + relations + lazy loading; JSI perf |
| **Reanimated 4 over Animated** | New API to learn, heavier native footprint | 60 fps gestures on low-end Android, UI-thread composability |
| **Fastify + Prisma over tRPC** | One more layer of schemas (Zod + Prisma) | Clearer separation; works with non-TS clients in the future; socket layer is easier to reason about |
| **Socket.IO over raw WebSocket** | ~40 KB client bundle | Auto-reconnect, acks, rooms, Redis adapter — all things I'd build anyway |
| **Fly.io over Vercel/Netlify** | No git-push-to-deploy UX out of the box | Persistent WebSockets, Docker control, region pinning |
| **Yarn workspaces over Nx/Turborepo** | No build caching, no task graph | Zero config, zero lock-in, fine for two apps + one shared package |
| **JWT + refresh rotation over sessions** | More client code for refresh handling | Stateless server; scales horizontally without sticky sessions |
| **Argon2 over bcrypt** | A few ms slower per login (by design) | Memory-hard, GPU-resistant, current OWASP recommendation |
| **Bare RN over Expo** | Slower onboarding for new devs | Full native module control; better for senior-level demo |

---

## 13. Recently shipped

These were on the "next" list in earlier drafts and are now in production:

- **Read receipts** — Per-message delivery + read state, `message.read` event, bilateral privacy (sender & receiver must both allow).
- **Presence / online status** — Redis-backed online presence with visibility gated by the user's privacy setting.
- **Typing indicators** — UI-thread dots animation, client respects MMKV privacy flag before emitting, server respects privacy cache before broadcasting.
- **Connections / friend requests** — `Connection` model with pending/accepted/ignored/blocked, connection-request cards, accept/ignore actions.
- **User privacy controls** — WhatsApp-style bilateral: read receipts, online status, typing indicators. Settings cached in Redis for O(1) socket-path lookups.
- **Personal information** — Bio, email, phone, DOB, location; edit via dedicated `PersonalInfoScreen` with per-field bottom sheets, validation (E.164 phone, age ≥ 13, email format). Profile screen is read-only; edits happen via Personal Info.
- **Neon cold-start mitigation** — DB warmup query on server boot + 4-minute keep-alive ping to prevent Neon's serverless Postgres from sleeping; mobile refresh timeout tuned to 15s with overall HTTP timeout at 30s.

## 14. What I'd build next

Ranked by impact-to-effort ratio:

1. **Push notifications** (3 days) — APNs + FCM via `@react-native-firebase/messaging`. Backend dispatches on `message.new` when target isn't online.
2. **Media messages** (4 days) — S3 presigned uploads, thumbnail generation on the server, progressive image loading on the client.
3. **Group chats polish** (3 days) — Avatars, mentions, admin/member roles in the UI. Data model already supports `kind = 'group'`.
4. **Message search** (1 week) — Postgres full-text for V1, migrate to Meilisearch if it becomes the bottleneck.
5. **Observability** (3 days) — OpenTelemetry traces on the server, Sentry on the mobile app, dashboards for p95 send-to-ack latency.
6. **E2E tests** (1 week) — Detox for the mobile app, `supertest` + `socket.io-client` for the server. CI runs them on every PR.
7. **E2E encryption (Signal protocol)** (2 weeks) — `libsignal` on both sides. Show the encrypted payload in the DB. The "senior+" stretch goal.

---

## Author

Built by **Debdut Saha** — a mobile/backend engineer who believes offline-first is a feature, animations are a language, and TypeScript on both sides of the wire is non-negotiable.
