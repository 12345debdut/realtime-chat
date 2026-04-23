# @rtc/server

Fastify + Socket.IO + Prisma backend for the Realtime Chat project.

## Stack

- **Fastify 4** — REST endpoints, error envelopes, rate limiting
- **Socket.IO 4** — realtime gateway with Redis adapter for horizontal scale
- **Prisma** — Postgres access (Neon serverless)
- **Redis** (Upstash) — Socket.IO pub/sub + privacy-settings cache (5-min TTL)
- **argon2** — password hashing
- **jsonwebtoken** — short-lived access + rotating refresh tokens
- **Zod** via `@rtc/contracts` — wire validation on every edge

## Layout

```
src/
├── index.ts            # boot, warmup, keep-alive ping
├── routes/
│   ├── auth.ts         # register, login, refresh, logout
│   ├── me.ts           # GET /me, PATCH /me/privacy, PATCH /me/profile
│   ├── users.ts        # public user search
│   ├── connections.ts  # friend requests (pending/accepted/ignored/blocked)
│   ├── rooms.ts        # DM + group rooms
│   └── tags.ts         # message tagging
├── sockets/
│   └── chat.ts         # message.send, message.read, typing, presence
├── lib/
│   ├── prisma.ts       # Prisma client with connect_timeout/pool_timeout for Neon
│   ├── redis.ts        # ioredis client
│   ├── privacyCache.ts # 5-min cached per-user privacy settings
│   ├── tokens.ts       # JWT sign + rotation
│   └── env.ts          # zod-validated env loader
├── middleware/         # auth guard, rate limit, error envelope
└── __tests__/          # vitest
prisma/
├── schema.prisma
└── migrations/
```

## Local development

```bash
# from repo root
yarn install
yarn workspace @rtc/contracts build   # required before server typecheck
yarn workspace @rtc/server db:generate
yarn workspace @rtc/server db:deploy  # apply migrations
yarn workspace @rtc/server dev        # tsx watch mode
```

### Required env vars

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pw@host/db` | Neon recommended |
| `REDIS_URL` | `redis://default:pw@host:port` | Upstash works |
| `JWT_ACCESS_SECRET` | 32+ random bytes | Rotate on compromise |
| `JWT_REFRESH_SECRET` | 32+ random bytes | Different from access |
| `PORT` | `8080` | Fly.io internal port |
| `NODE_ENV` | `production` | Enables stricter error envelopes |

Copy `.env.example` (TODO add) → `.env` for local dev.

## Scripts

| Script | Purpose |
|---|---|
| `yarn dev` | tsx watch |
| `yarn build` | tsc emit to `dist/` |
| `yarn start` | `node dist/index.js` |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn test` | vitest run |
| `yarn db:generate` | Prisma client codegen |
| `yarn db:migrate` | create + apply new migration (dev only) |
| `yarn db:deploy` | apply existing migrations (prod) |
| `yarn db:studio` | Prisma GUI |

## Prisma migrations

Creating a new migration (local):

```bash
yarn workspace @rtc/server db:migrate --name add_something
```

Applying to production (fly.io):

```bash
fly ssh console -C "npx prisma migrate deploy"
```

If a column was applied manually ahead of the migration file:

```bash
fly ssh console -C "npx prisma migrate resolve --applied <migration_name>"
```

## Socket protocol

Authenticated via `handshake.auth.token` (JWT access). Socket `data.userId` is set server-side before any event is accepted.

```
client → server
  message.send     { clientId, roomId, body, kind? }
  message.read     { roomId, upToMessageId }
  typing.start     { roomId }
  typing.stop      { roomId }

server → client
  message.new      { serverId, clientId, roomId, body, senderId, createdAt }
  message.ack      { clientId, serverId, createdAt }
  message.read     { roomId, userId, upToMessageId }
  typing           { roomId, userId, isTyping }
  presence         { userId, online, lastSeenAt? }
```

Every payload is Zod-validated before the handler runs. Invalid = rejected with typed error envelope.

## Privacy enforcement

Read receipts, typing indicators, and presence all pass through `privacyCache.getPrivacy(userId)` before broadcasting:

- **Read receipts** — always persist `lastReadMessageId`, only broadcast if both sender and receiver have it enabled.
- **Typing** — only broadcast if the sender has typing enabled.
- **Presence** — only broadcast if the user has online-status visible.

Cache invalidates on `PATCH /me/privacy`.

## Deployment

Ships to Fly.io as a Docker image (see root `fly.toml` + server `Dockerfile`). The build stage compiles `packages/contracts` before `apps/server` because the runtime `require('@rtc/contracts')` resolves to the built `dist/index.js`.

Key fly.io settings for a WebSocket server:
- `auto_stop_machines = "off"`
- `min_machines_running = 1`
- Primary region close to users (I use `bom`)

## Neon cold-start notes

Neon pauses idle compute. To avoid cold-start timeouts:
1. `SELECT 1` warmup on server boot in `index.ts`.
2. Keep-alive ping every 4 minutes.
3. `connect_timeout=30&pool_timeout=30` appended to `DATABASE_URL` in `lib/prisma.ts`.
