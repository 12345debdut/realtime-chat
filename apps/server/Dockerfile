# syntax=docker/dockerfile:1.7

# Multi-stage Dockerfile for the Fastify + Socket.IO server.
# Build context MUST be the monorepo root so the @rtc/contracts and
# @rtc/tsconfig workspaces are visible. `fly.toml` at the repo root
# already points here.

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl python3 make g++

# ── deps: only the files needed to resolve workspaces ────────────────────
FROM base AS deps
ENV YARN_ENABLE_IMMUTABLE_INSTALLS=false
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn
COPY apps/server/package.json apps/server/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/tsconfig/base.json packages/tsconfig/base.json
RUN corepack enable && yarn install

# ── build: compile contracts → Prisma client → server TS ────────────────
FROM deps AS build
COPY packages/contracts packages/contracts
COPY apps/server apps/server
# Contracts must be compiled first — the server imports from @rtc/contracts
# at runtime, and its package.json now points `main` at dist/index.js.
WORKDIR /app/packages/contracts
# Clear any stale incremental build metadata before compiling.
# tsc `incremental: true` persists a .tsbuildinfo that, if stale,
# convinces tsc to skip emit entirely — see the .dockerignore note.
RUN rm -f tsconfig.tsbuildinfo dist/tsconfig.tsbuildinfo && yarn build
RUN test -f dist/index.js || (echo "FATAL: contracts build did not emit dist/index.js" && exit 1)

WORKDIR /app/apps/server
RUN yarn prisma generate
RUN rm -f tsconfig.tsbuildinfo dist/tsconfig.tsbuildinfo && yarn build
RUN test -f dist/index.js || (echo "FATAL: server build did not emit dist/index.js" && exit 1)

# ── runtime: slimmer image with only what's needed to run ────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=build /app /app
WORKDIR /app/apps/server
EXPOSE 4000
CMD ["sh", "-c", "yarn prisma migrate deploy && node dist/index.js"]
