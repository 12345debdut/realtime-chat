# Contributing

Thanks for considering a contribution. This doc covers how to run the monorepo locally, house style, and what to expect from the PR flow.

## Prerequisites

- **Node.js 22.11+** (use `nvm`; `.nvmrc` pinned to 22)
- **Yarn 3.6.4** (vendored via corepack — `corepack enable` is all you need)
- **Xcode 16+** and/or **Android Studio** for mobile work
- **Ruby 3.3+** + **Bundler** for CocoaPods (macOS system Ruby is too old)
- **Docker** (optional — only if you want Postgres locally)

## Bootstrap

```bash
corepack enable
yarn install
yarn build:contracts          # must run before server/mobile typecheck
yarn workspace @rtc/server db:generate
```

For iOS:

```bash
cd apps/mobile/ios && bundle install && bundle exec pod install && cd ../..
```

## Running locally

Each app runs independently.

```bash
# Server
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://localhost:6379
export JWT_ACCESS_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
yarn workspace @rtc/server db:deploy
yarn workspace @rtc/server dev

# Mobile
yarn workspace @rtc/mobile start --reset-cache
yarn workspace @rtc/mobile ios --simulator="iPhone 15 Pro"
# or
yarn workspace @rtc/mobile android
```

## Before you open a PR

Run the one-shot CI-equivalent:

```bash
yarn ci
```

This is `build:contracts → lint → typecheck → test` across every workspace. CI runs the same thing.

If you only touched one workspace, faster loop:

```bash
yarn workspace @rtc/server typecheck && yarn workspace @rtc/server test
yarn workspace @rtc/mobile typecheck && yarn workspace @rtc/mobile test
```

## House style

- **Shared schema first.** If the wire format changes, edit `packages/contracts/src/*.ts` first, rebuild, then update server and mobile. The type system catches drift.
- **Server-side validation is not optional.** Every route that takes a body `safeParse`s it against a Zod schema from `@rtc/contracts`. Invalid input → 400 with the typed error envelope, not a 500.
- **Privacy leaks are bugs.** Any endpoint that returns a user other than "you" uses `PublicUserSchema` (no bio/email/phone/DOB/location). `GET /me` is the only endpoint that returns the full `UserSchema`.
- **Optimistic UI.** Mobile writes to WatermelonDB first and lets the observer re-render; network is a side channel.
- **No `any` in new production code.** Tests may use `any` for mocks. Legacy sites are grandfathered; don't add more.

## Commit style

No rigid convention, but follow what's already in the log:

```
type: short imperative summary

Optional body explaining the why. Wrap at ~80 chars.
```

Prefixes seen in the history: `feat`, `fix`, `refactor`, `docs`, `chore`, `ci`, `deps`, `test`, `build`. Use them if it's obvious; don't over-engineer it.

## PR flow

1. Fork, branch off `main`, open a draft PR early.
2. Fill in the PR template. Screenshots / recordings for mobile changes.
3. CI must be green. `yarn ci` fails → CI fails.
4. One approval from a maintainer + green CI → merge.
5. `apps/server` changes merged to `main` auto-deploy to Fly.io via the `deploy-server.yml` workflow.

## Database migrations

Local:

```bash
yarn workspace @rtc/server db:migrate --name descriptive_change
```

Production:

```bash
fly ssh console -C "npx prisma migrate deploy"
```

If a column was manually applied ahead of a migration file:

```bash
fly ssh console -C "npx prisma migrate resolve --applied <migration_name>"
```

## Reporting security issues

Please do **not** open a public issue for a vulnerability. Email the repo owner directly. We'll acknowledge within 72 hours.

## Code of Conduct

Be kind. Assume good intent. Disagreements about engineering are fine; making it personal is not.
