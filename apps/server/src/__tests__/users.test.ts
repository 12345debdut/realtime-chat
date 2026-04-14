import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import './helpers';
import { buildTestApp, createMockUser } from './helpers';
import { prisma } from '../lib/prisma';
import { userRoutes } from '../routes/users';

const mockPrisma = prisma as any;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp(userRoutes);
});

afterAll(async () => {
  await app.close();
});

function inject(url: string, userId = 'user-1') {
  return app.inject({
    method: 'GET',
    url,
    headers: {
      'x-test-user-id': userId,
      'x-test-user-handle': 'testuser',
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /users', () => {
  it('should exclude the current user from results', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);

    const otherUser = createMockUser({ id: 'user-2', handle: 'bob', displayName: 'Bob' });
    mockPrisma.user.findMany.mockResolvedValue([otherUser]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('user-2');

    // Verify user.findMany was called with notIn containing current user
    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.id.notIn).toContain('user-1');
  });

  it('should exclude users with a pending sent connection request', async () => {
    // user-1 sent a pending request to user-3
    mockPrisma.connectionRequest.findMany.mockResolvedValue([
      { senderId: 'user-1', receiverId: 'user-3' },
    ]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.id.notIn).toContain('user-3');
  });

  it('should exclude users with a pending received connection request', async () => {
    // user-3 sent a pending request to user-1
    mockPrisma.connectionRequest.findMany.mockResolvedValue([
      { senderId: 'user-3', receiverId: 'user-1' },
    ]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.id.notIn).toContain('user-3');
  });

  it('should exclude users with an accepted connection', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([
      { senderId: 'user-1', receiverId: 'user-4' },
    ]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.id.notIn).toContain('user-4');
  });

  it('should include users with an ignored connection (not excluded)', async () => {
    // Ignored connections are NOT returned by the connectionRequest query
    // because the query filters status: { in: ['pending', 'accepted'] }
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);

    const ignoredUser = createMockUser({ id: 'user-5', handle: 'eve', displayName: 'Eve' });
    mockPrisma.user.findMany.mockResolvedValue([ignoredUser]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('user-5');

    // Verify the connectionRequest query filters by pending/accepted only
    const connQuery = mockPrisma.connectionRequest.findMany.mock.calls[0][0];
    expect(connQuery.where.status.in).toEqual(['pending', 'accepted']);
  });

  it('should search by handle (case-insensitive)', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await inject('/users?search=BOB');

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.OR).toBeDefined();
    const handleFilter = findManyCall.where.OR.find((f: any) => f.handle);
    expect(handleFilter.handle.contains).toBe('BOB');
    expect(handleFilter.handle.mode).toBe('insensitive');
  });

  it('should search by displayName', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await inject('/users?search=Alice');

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    const displayNameFilter = findManyCall.where.OR.find((f: any) => f.displayName);
    expect(displayNameFilter.displayName.contains).toBe('Alice');
    expect(displayNameFilter.displayName.mode).toBe('insensitive');
  });

  it('should limit results to 50', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await inject('/users');

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(50);
  });

  it('returns all eligible users when search query is empty', async () => {
    mockPrisma.connectionRequest.findMany.mockResolvedValue([]);
    mockPrisma.membership.findMany.mockResolvedValue([]);

    const userA = createMockUser({ id: 'user-2', handle: 'alice', displayName: 'Alice' });
    const userB = createMockUser({ id: 'user-3', handle: 'bob', displayName: 'Bob' });
    mockPrisma.user.findMany.mockResolvedValue([userA, userB]);

    const res = await inject('/users');

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(2);
    expect(json.map((u: any) => u.id)).toEqual(['user-2', 'user-3']);

    // Verify no OR search filter is applied when search param is absent
    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.OR).toBeUndefined();
  });
});
