# Security policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a security concern.

Email the repo owner directly. We'll acknowledge within **72 hours** and aim to share a preliminary assessment within **7 days**. If the finding is credible we'll coordinate disclosure after a fix is available.

When reporting, please include:

- A description of the issue and potential impact
- Steps to reproduce or a proof-of-concept
- The affected commit SHA or deploy URL
- Your preferred attribution (name / handle / anonymous) for the eventual advisory

## Scope

| In scope | Out of scope |
|---|---|
| Server (`apps/server/`) on the production deploy | Third-party dependencies (report to upstream; we'll pick up the fix) |
| Mobile app (`apps/mobile/`) published builds | Local dev misconfigurations (e.g., exposed localhost Postgres) |
| Protocol design flaws (auth, socket, privacy model) | Phishing or social-engineering attacks on users |
| Secrets in git history or deploy artifacts | Self-XSS / things that require compromising the user's own device |

## Current security posture

### Auth

- **Password hashing:** argon2id with per-user salt.
- **Access tokens:** 15-minute JWTs, signed with `JWT_ACCESS_SECRET` (≥32 bytes of random data in production).
- **Refresh tokens:** 30-day rotating tokens stored as `sha256(token)` in the DB. Each successful refresh issues a new token and revokes the old one.
- **Rate limits:** 10 req/min/IP on `/auth/register`, `/auth/login`, `/auth/refresh`. 300 req/min/IP global.

### Transport

- HTTPS + WSS end-to-end via Fly's edge.
- CORS restricted to `WEB_ORIGIN` allowlist in production. Mobile clients don't send `Origin`, so they're unaffected.
- Helmet enabled (HSTS, X-Content-Type-Options, Referrer-Policy).

### Socket

- JWT verified in the `io.use()` middleware before `connection` fires.
- `socket.data.user.sub` is server-set from the verified token — never from client input.
- Room membership is checked on every `message.send`, `message.read`, `typing.*`.

### Data

- Prisma parameterizes every query — no raw SQL surface.
- Per-user privacy flags (read receipts, online status, typing) enforced both client-side and server-side.
- `PublicUserSchema` in `@rtc/contracts` prevents `bio`, `email`, `phone`, `dateOfBirth`, `location` from leaking through non-`/me` endpoints.

### Deploy

- Fly.io secrets, never committed.
- GitHub Actions uses the `production` environment with a required reviewer for deploys.
- Dependabot alerts enabled; weekly dependency bumps; `gitleaks` runs on every PR.

## Known follow-ups

Filed as GitHub issues, not blockers for public release:

- Treat refresh-token reuse as family compromise (revoke all of a user's refresh tokens, not just the presented one).
- Per-socket token re-verification after the access token's `exp`.
- Rate limits on `/connections/request` (spam vector) and `/users?search=` (directory scraping).
- Group-room creation should require `memberIds` to be accepted connections of the creator.

## Out of scope today (intentional)

- **End-to-end encryption.** Signal-protocol layer is planned but not implemented. Treat the server as trusted infrastructure that can see message bodies.
- **2FA / passkeys.** Single-factor auth with rate-limited login + short-lived JWTs.
- **Device fingerprinting / anomaly detection.** No behavioral anti-abuse system.

These are documented rather than hidden so you know what the product currently does and doesn't protect.
