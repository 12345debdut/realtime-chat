# Changelog

All notable changes to this project are documented here. Dates in ISO format. The project follows [Semantic Versioning](https://semver.org/) from the first tagged release onward; pre-1.0 entries are grouped by date.

Format inspired by [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Repo hygiene for public release** — Apache-2.0 `LICENSE` + `NOTICE`, per-package READMEs for `@rtc/server` / `@rtc/contracts` / `@rtc/tsconfig`, enhanced root README with "Recently shipped" section.
- **CI / CD** — GitHub Actions workflow for build/lint/typecheck/test on every PR + push to main. Auto-deploy workflow for `apps/server` → Fly.io, gated on the `production` environment for manual approval.
- **Dependabot** — weekly npm bumps (grouped minors/patches), monthly github-actions + docker.
- **Issue + PR templates** — form-based bug / feature, summary / test-plan / risks PR template.
- **Branch protection checklist** — `.github/BRANCH_PROTECTION.md` for post-push GitHub UI setup.
- **CONTRIBUTING.md** — local-dev quickstart, house style, PR flow.
- **SECURITY.md + PRIVACY.md** — responsible-disclosure policy, data-collection notice.
- **Architecture Decision Records** under `docs/adr/` for the three most consequential design choices (see below).
- **`yarn ci`** one-shot script — builds contracts, lints, typechecks, tests all workspaces.
- **`eslint-import-resolver-typescript`** — fixes the ~200 false-positive "cannot resolve" errors in lint.
- **Secrets gates** — `.gitleaks.toml` config, `gitleaks-action` run in CI, `apps/server/.env.example` documents every required var.

### Changed
- **Server CORS** tightened — dev is permissive, prod restricts to a `WEB_ORIGIN` allowlist (REST + Socket.IO). `WEB_ORIGIN` is now an env var.
- **Helmet** registered on the Fastify app (HSTS, X-Content-Type-Options, Referrer-Policy). CSP disabled since the server is JSON-only.
- **Rate limits** — 10 req/min/IP on `/auth/register`, `/auth/login`, `/auth/refresh`. 300 req/min/IP global backstop.
- **ESLint rules** — `@typescript-eslint/no-explicit-any` demoted from error to warn (test mocks legitimately need it; kept visible). `react-native/no-inline-styles` disabled (theme-aware inline styles are an intentional pattern).
- **Profile screen is now read-only.** All editing flows through the dedicated `PersonalInfoScreen`.
- **`@rtc/mobile` and package-per-workspace READMEs** — replaced the React Native boilerplate with stack / layout / key-pattern docs.

### Fixed
- **Server test suite** (was 3/69 passing, now 69/69) — root cause was `vi.mock` file-scope: mocks in `helpers.ts` didn't apply to test files' own imports. Moved module mocks to `setup.ts` (vitest `setupFiles`) and used `vi.hoisted` for the Prisma proxy since `vi.fn()` inside a hoisted `vi.mock` factory silently produces non-spy functions.
- **Mobile test suite** (was 34/38 passing, now 38/38) — missing `memberships.create` and `getActiveRoomId` mocks in `RoomRepository.test.ts`; one test wasn't assigning `id` on the captured record after `setter`, causing Watermelon `Q.where('room_id', undefined)` to crash.
- **Mobile typecheck** (was 5 errors, now 0) — widened `PressableScale.style` from `ViewStyle` to `StyleProp<ViewStyle>` (fixed 4 call sites in one edit); typed a test mock as `any`.
- **`yarn ci` script path** — root `package.json` had broken yarn-1 scripts (`yarn workspaces run` doesn't exist in yarn 3); replaced with explicit per-workspace commands.
- **`packageManager` field** in root `package.json` was `yarn@1.22.22` despite the repo running on yarn 3.6.4.
- **Stray `console.log`** in `SyncEngine.ts` removed.

### Security
- Credentials-stuffing surface on `/auth/login` closed by per-IP rate limiting.
- Production CORS no longer reflects arbitrary origins.

---

## 2026-04-16 — Personal information

### Added
- 5 nullable columns on `User` (`bio`, `email`, `phone`, `dateOfBirth`, `location`) via Prisma migration.
- `PATCH /me/profile` with Zod validation, age ≥ 13 check, E.164 phone format, trim + lowercase email.
- `PublicUserSchema` in `@rtc/contracts` — prevents personal info from leaking through connection/peer endpoints.
- `PersonalInfoScreen` with per-field bottom-sheet editing, masked email/phone display, character counter for bio, optimistic UI.
- Pull-to-refresh on empty `ChatListScreen`.

### Changed
- `AuthRepository.restoreUser()` backfills the 5 new personal-info fields for users cached before the feature.
- `GET /me`, `/auth/login`, `/auth/register` responses now include all personal-info + privacy fields.

## 2026-04-16 — Neon cold-start mitigation

### Fixed
- `RoomRepo.syncFromServer` was timing out on first request after idle (Neon serverless Postgres pauses inactive compute). Fix:
  - `connect_timeout=30&pool_timeout=30` appended to Prisma connection string.
  - Warmup query on server boot.
  - 4-minute keep-alive ping.
  - Mobile HTTP timeout raised from 15s → 30s; auth refresh capped at 15s.

## 2026-04-15 — Privacy settings + connections redesign

### Added
- Per-user privacy flags (`readReceiptsEnabled`, `onlineStatusVisible`, `typingIndicatorsEnabled`) with server-side enforcement via Redis-cached lookups.
- WhatsApp-style bilateral model — disabling read receipts stops both sending and receiving.
- `PATCH /me/privacy` with optimistic UI + rollback on mobile.
- Redesigned `ConnectionsScreen` — animated segmented control, editorial card layout, sent-requests tab.
- Connection-request notes (optional first message on send).
- Date dividers in chat room (Today / Yesterday / formatted).
- `PrivacyScreen` with full navigation.

### Changed
- Swapped to Montserrat font family across mobile.
- Hid search bar and menu when the chat list is empty.
- Fixed empty-state overlap with the floating tab bar.

## 2026-04-14 — Baseline chat application

First end-to-end working build: auth, rooms, DMs, messages, sockets, offline-first sync. This is the commit worth showing interviewers if they want "the smallest thing that proves the architecture works."

## 2026-04-08 — Repository bootstrap

Monorepo scaffold: `apps/server` (Fastify + Prisma + Socket.IO), `apps/mobile` (RN 0.85 bare), `packages/contracts` (Zod schemas), `packages/tsconfig`. Docker + fly.toml. Initial README.
