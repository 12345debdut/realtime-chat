# ADR 0003 — `PublicUserSchema` to prevent personal-info leaks

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** Debdut Saha

## Context

When the app added five optional personal-info fields to the `User` model — `bio`, `email`, `phone`, `dateOfBirth`, `location` — it introduced a new class of privacy bug: endpoints that return user data (connection requests, peer info in DMs, user search) could now accidentally return the full `User` shape and leak personal info.

The naive fix — "remember to omit personal fields in each route handler" — is a footgun. New personal fields added later would need every route audited. A new route written by a future contributor might forget entirely.

We need the *type system* to enforce this, not reviewer discipline.

## Decision

**Introduce a distinct `PublicUserSchema` in `@rtc/contracts` and use it in every place a user other than the caller appears.** `UserSchema` remains the full shape and is returned only by self-endpoints (`GET /me` and its derivatives).

```ts
// packages/contracts/src/auth.ts

export const UserSchema = z.object({
  id: IdSchema,
  handle: z.string().min(3).max(32),
  displayName: z.string().min(1).max(64),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().max(280).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().date().nullable(),
  location: z.string().max(100).nullable(),
  privacy: PrivacySettingsSchema,
  createdAt: TimestampSchema,
});

export const PublicUserSchema = UserSchema.omit({
  bio: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  location: true,
});
```

Both client and server consume the same schemas. Server-side, `shapeUser()` helpers and `Prisma.UserSelect` definitions mirror `PublicUserSchema` exactly so the leak cannot happen by construction.

## Consequences

### Positive

- **Adding a new personal field** means adding it to `UserSchema`, adding it to the `.omit()` list in `PublicUserSchema`, adding it to the Prisma select statements, and — only then — it becomes available to `GET /me`. The type system flags every route that tries to return the new field to a non-self caller.
- **Connections, user search, room member lists** all use `PublicUser` and cannot accidentally leak personal info even if a reviewer misses it.
- **Mobile clients** that receive a `PublicUser` never see uninitialized/null personal fields on other users — the types don't include them, so the UI can't render them.

### Negative

- **Two shapes to maintain.** When `UserSchema` changes, `PublicUserSchema` must be reviewed. This is why the `.omit()` list is a small, named constant — easier to spot in PRs than a scattered set of `.pick()` calls.
- **Server-side Prisma `select` duplication.** Every query that returns a `PublicUser` must specify a safe field list. If a contributor writes `user: true`, everything leaks. Mitigation: a `PrismaUserSelect` constant in `routes/connections.ts` is reused everywhere.
- **New personal field added to `UserSchema`** but forgotten in `.omit()` → silent leak. Mitigation: `packages/contracts/README.md` documents this as a step; the `.omit()` list lives directly under `UserSchema` so it's hard to miss.

## Alternatives rejected

- **Single `UserSchema`, hand-omit fields at each handler.** Rejected — the exact class of bug we're trying to prevent.
- **Two entirely separate schemas (no `.omit()` relationship).** Rejected — they'd drift. Using `UserSchema.omit(...)` guarantees `PublicUserSchema` stays a strict subset.
- **Middleware that strips fields from responses.** Rejected — runtime enforcement, not compile-time. A hostile middleware bypass or a new endpoint that skips the middleware brings the leak back.
- **Mark fields `@internal` in a JSDoc and trust reviewers.** Rejected — not enforceable.

## Implementation touchpoints

- `packages/contracts/src/auth.ts` — `UserSchema` + `PublicUserSchema`
- `packages/contracts/src/connections.ts` — uses `PublicUserSchema` for `sender`, `receiver`, `peer`
- `apps/server/src/routes/connections.ts` — `shapeUser()` returns `PublicUser`, `PrismaUserSelect` enumerates safe fields only
- `apps/server/src/routes/users.ts` — `/users?search=` returns `PublicUser[]`
- `apps/server/src/routes/me.ts` — `GET /me` is the ONLY endpoint that returns full `UserSchema`
- `packages/contracts/README.md` — documents the pattern for contributors

## Notes

See `PRIVACY.md` for the data-collection implications. See ADR 0002 for the related decision about privacy-flag enforcement at the socket layer.
