# @rtc/contracts

Zod schemas shared between `@rtc/mobile` and `@rtc/server`. This package is the single source of truth for the wire format.

## Why this exists

The #1 source of bugs in a client/server project is drift between the two halves of a schema. When the server renames `username → handle` but the mobile app still reads `username`, you don't find out until a user crashes. This package makes that impossible:

- The server imports `UserSchema` to shape its responses and validate its inputs.
- The mobile app imports `UserSchema` to parse what it receives.
- A breaking change is a TypeScript compile error on both sides at the next `yarn typecheck`.

## Layout

```
src/
├── primitives.ts    # branded IDs (UserId, RoomId, MessageId), ISO timestamps
├── auth.ts          # UserSchema, PublicUserSchema, PrivacySettingsSchema,
│                    # ProfileUpdateSchema, register/login/refresh payloads
├── connections.ts   # ConnectionSchema, requests (uses PublicUserSchema)
├── rooms.ts         # Room, Membership, DM/group variants
├── messages.ts      # MessageSchema, send payload, kinds
├── events.ts        # socket event catalog (client↔server)
└── index.ts         # barrel
```

## The `UserSchema` vs `PublicUserSchema` split

`UserSchema` includes every field about a user — including personal info (`bio`, `email`, `phone`, `dateOfBirth`, `location`) and privacy settings. It's only used by `GET /me` and related self-endpoints.

`PublicUserSchema` is `UserSchema.omit({ bio: true, email: true, phone: true, dateOfBirth: true, location: true })`. It's used anywhere another user appears — connections, peers, search results. This prevents personal info from leaking through unrelated endpoints.

```ts
export const PublicUserSchema = UserSchema.omit({
  bio: true, email: true, phone: true, dateOfBirth: true, location: true,
});
```

If you add a new personal-info field, remember to add it to the `.omit()` list.

## Build

```bash
yarn workspace @rtc/contracts build   # emits dist/
```

The server and mobile app consume the **built** `dist/`, not `src/`. Always rebuild after editing:

```bash
yarn workspace @rtc/contracts build && yarn workspace @rtc/server typecheck
```

## Adding a schema

1. Create/edit the file in `src/`.
2. Export from `src/index.ts`.
3. Rebuild: `yarn workspace @rtc/contracts build`.
4. Import on both sides: `import { MyNewSchema } from '@rtc/contracts'`.
5. On the server, validate at the boundary (`safeParse` returns a typed error envelope).
6. On the mobile app, validate what you receive (`parse` throws; handle via try/catch or react-query's error boundary).
