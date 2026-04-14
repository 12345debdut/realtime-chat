import { vi } from 'vitest';

// ── Mock Prisma at module level ────────────────────────────────────────────
// Every import of '../lib/prisma' across the codebase will receive this mock.
vi.mock('../lib/prisma', () => ({
  prisma: mockPrismaClient(),
}));

// ── Mock socket getIO to return a controllable fake ────────────────────────
vi.mock('../sockets/chat', () => ({
  getIO: vi.fn(() => null),
  getUserSockets: vi.fn(() => new Map()),
}));

// ── Mock authenticate middleware so route tests skip real JWT ──────────────
vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn(async (req: any, _reply: any) => {
    // Tests set req.headers['x-test-user-id'] to control the authenticated user.
    req.user = {
      sub: req.headers['x-test-user-id'] ?? 'test-user-id',
      handle: req.headers['x-test-user-handle'] ?? 'testuser',
    };
  }),
}));

// ── Mock env so token helpers don't crash on missing vars ──────────────────
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

// ── Prisma mock factory ────────────────────────────────────────────────────
// Returns a deeply-chainable proxy: any property access returns a vi.fn()
// that is cached by name. prisma.user.findMany() works, prisma.$transaction() too.

type MockPrisma = Record<string, any>;

export function mockPrismaClient(): MockPrisma {
  const cache: Record<string, any> = {};

  const handler: ProxyHandler<MockPrisma> = {
    get(_target, model: string) {
      if (model === 'then') return undefined; // prevent Promise-like behaviour

      if (!cache[model]) {
        if (model === '$transaction') {
          // $transaction can receive either a callback or an array of promises.
          cache[model] = vi.fn(async (fnOrArray: any) => {
            if (Array.isArray(fnOrArray)) return Promise.all(fnOrArray);
            return fnOrArray(proxy);
          });
        } else if (model === '$queryRaw' || model === '$executeRaw') {
          // Tagged template calls: prisma.$queryRaw`...` — default to empty result
          cache[model] = vi.fn(async () => []);
        } else {
          // Each model is itself a proxy so prisma.user.findMany etc. auto-create mocks.
          const methodCache: Record<string, any> = {};
          cache[model] = new Proxy(
            {},
            {
              get(_t, method: string) {
                if (method === 'then') return undefined;
                if (!methodCache[method]) {
                  methodCache[method] = vi.fn();
                }
                return methodCache[method];
              },
            },
          );
        }
      }
      return cache[model];
    },
  };

  const proxy = new Proxy({} as MockPrisma, handler);
  return proxy;
}

// ── Data factories ─────────────────────────────────────────────────────────

const now = new Date('2025-01-15T12:00:00Z');

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    handle: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    passwordHash: 'hashed',
    createdAt: now,
    ...overrides,
  };
}

export function createMockConnectionRequest(overrides: Record<string, any> = {}) {
  return {
    id: 'conn-req-1',
    senderId: 'user-1',
    receiverId: 'user-2',
    status: 'pending' as const,
    message: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockRoom(overrides: Record<string, any> = {}) {
  return {
    id: 'room-1',
    kind: 'dm' as const,
    title: null,
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: null,
    lastMessageAt: null,
    memberships: [
      { id: 'mem-1', userId: 'user-1', roomId: 'room-1' },
      { id: 'mem-2', userId: 'user-2', roomId: 'room-1' },
    ],
    pins: [],
    roomTags: [],
    ...overrides,
  };
}

export function createMockTag(overrides: Record<string, any> = {}) {
  return {
    id: 'tag-1',
    userId: 'user-1',
    name: 'Work',
    color: '#FF6B6B',
    createdAt: now,
    ...overrides,
  };
}

export function createMockRoomTag(overrides: Record<string, any> = {}) {
  return {
    id: 'rt-1',
    roomId: 'room-1',
    tagId: 'tag-1',
    tag: createMockTag(),
    ...overrides,
  };
}

export function createMockMembership(overrides: Record<string, any> = {}) {
  return {
    id: 'mem-1',
    userId: 'user-1',
    roomId: 'room-1',
    joinedAt: now,
    lastReadMessageId: null,
    ...overrides,
  };
}

// ── Fastify test app builder ───────────────────────────────────────────────
import Fastify from 'fastify';

export async function buildTestApp(
  registerRoutes: (app: any) => Promise<void>,
) {
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  await app.ready();
  return app;
}
