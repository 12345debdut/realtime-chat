/**
 * Test helpers — data factories + test-app builder.
 *
 * Module mocks (prisma, sockets, authenticate, env, privacyCache) live in
 * `setup.ts`, not here. `vi.mock` is file-scoped; moving the mock calls to
 * the vitest global `setupFiles` entry is what makes them apply to every
 * test file's own `import { prisma } from '../lib/prisma'`.
 */
import Fastify from 'fastify';

// ── Data factories ─────────────────────────────────────────────────────────

const now = new Date('2025-01-15T12:00:00Z');

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    handle: 'alice',
    displayName: 'Alice',
    avatarUrl: null,
    passwordHash: 'hashed',
    readReceiptsEnabled: true,
    onlineStatusVisible: true,
    typingIndicatorsEnabled: true,
    bio: null,
    email: null,
    phone: null,
    dateOfBirth: null,
    location: null,
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

export async function buildTestApp(
  registerRoutes: (app: any) => Promise<void>,
) {
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  await app.ready();
  return app;
}
