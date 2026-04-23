/**
 * Vitest global setup — runs once per test file before its imports resolve.
 *
 * Two responsibilities:
 *
 * 1. **Seed test env vars.** `lib/env.ts` throws at import time on missing
 *    `DATABASE_URL`, `JWT_*_SECRET`, etc. Without these, every test file
 *    crashes before its first `it(...)` runs.
 *
 * 2. **Install module mocks globally.** `vi.mock(...)` is scoped to the file
 *    it's called in — putting the mocks in `helpers.ts` and importing
 *    helpers from the test file does NOT mock the test file's own
 *    `import { prisma } from '../lib/prisma'`. Mocks in `setupFiles`, on
 *    the other hand, are applied to every test file.
 *
 * The prisma mock itself is a lazy Proxy: `prisma.<model>.<method>` returns a
 * `vi.fn()` that's cached on first access. Tests can then do
 * `(prisma as any).user.findMany.mockResolvedValue(...)` against any model
 * without us having to enumerate the Prisma schema here.
 *
 * Why `vi.hoisted`: the Proxy has to be constructed before `vi.mock`'s factory
 * runs (vi.mock is hoisted above imports). `vi.hoisted` is the official escape
 * hatch — code inside it runs at hoist time with a properly-wired `vi`.
 */
import { vi } from 'vitest';

// ── 1. Env vars ────────────────────────────────────────────────────────────
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-min-16-chars';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-16-chars';

// ── 2. Prisma mock (Proxy) — built inside vi.hoisted ───────────────────────
const { prismaMock } = vi.hoisted(() => {
  type AnyMap = Record<string, any>;

  const cache: AnyMap = {};
  const proxy: AnyMap = new Proxy({} as AnyMap, {
    get(_t, model: string) {
      if (model === 'then') return undefined;
      if (!cache[model]) {
        if (model === '$transaction') {
          cache[model] = vi.fn(async (fnOrArray: any) => {
            if (Array.isArray(fnOrArray)) return Promise.all(fnOrArray);
            return fnOrArray(proxy);
          });
        } else if (model === '$queryRaw' || model === '$executeRaw') {
          cache[model] = vi.fn(async () => []);
        } else {
          const methodCache: AnyMap = {};
          cache[model] = new Proxy(
            {},
            {
              get(_tm, method: string) {
                if (method === 'then') return undefined;
                if (!methodCache[method]) methodCache[method] = vi.fn();
                return methodCache[method];
              },
            },
          );
        }
      }
      return cache[model];
    },
  });

  return { prismaMock: proxy };
});

// ── 3. Install mocks — these apply to every test file via setupFiles ───────
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('../sockets/chat', () => ({
  getIO: vi.fn(() => null),
  getUserSockets: vi.fn(() => new Map()),
}));

vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn(async (req: any, _reply: any) => {
    // Tests control the authenticated user via request headers.
    req.user = {
      sub: req.headers['x-test-user-id'] ?? 'test-user-id',
      handle: req.headers['x-test-user-handle'] ?? 'testuser',
    };
  }),
}));

vi.mock('../lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 4000,
    DATABASE_URL: 'postgres://test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test-access-secret-long-enough',
    JWT_REFRESH_SECRET: 'test-refresh-secret-long-enough',
    ACCESS_TTL_SEC: 900,
    REFRESH_TTL_SEC: 2592000,
  },
}));

// `lib/privacyCache.ts` reads Redis on every socket event. In tests we just
// return the default "all-on" privacy settings — the routes/sockets we test
// do not depend on varying this.
vi.mock('../lib/privacyCache', () => ({
  getPrivacy: vi.fn(async () => ({
    readReceiptsEnabled: true,
    onlineStatusVisible: true,
    typingIndicatorsEnabled: true,
  })),
  invalidatePrivacy: vi.fn(async () => undefined),
}));
