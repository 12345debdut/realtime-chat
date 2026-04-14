import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import './helpers';
import { buildTestApp, createMockMembership, createMockRoom, createMockTag, createMockRoomTag, createMockUser } from './helpers';
import { prisma } from '../lib/prisma';
import { roomRoutes } from '../routes/rooms';

const mockPrisma = prisma as any;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp(roomRoutes);
});

afterAll(async () => {
  await app.close();
});

function inject(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  opts: { userId?: string; body?: any } = {},
) {
  const headers: Record<string, string> = {
    'x-test-user-id': opts.userId ?? 'user-1',
    'x-test-user-handle': 'testuser',
  };
  // Only set content-type for requests that have a body to avoid Fastify 400
  if (opts.body) {
    headers['content-type'] = 'application/json';
  }
  return app.inject({
    method,
    url,
    headers,
    ...(opts.body ? { payload: opts.body } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // $queryRaw returns unread counts — default to empty (0 unread for all rooms)
  mockPrisma.$queryRaw.mockResolvedValue([]);
});

describe('POST /rooms', () => {
  it('should return 403 when trying to create a DM room directly', async () => {
    const res = await inject('POST', '/rooms', {
      body: { kind: 'dm', memberIds: ['user-2'] },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('dm_rooms_created_via_connections');
  });

  it('should create a group room and return 201', async () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const room = {
      id: 'room-group',
      kind: 'group',
      title: 'Dev Team',
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: null,
      lastMessageAt: null,
      memberships: [
        { id: 'mem-1', userId: 'user-1', roomId: 'room-group' },
        { id: 'mem-2', userId: 'user-2', roomId: 'room-group' },
        { id: 'mem-3', userId: 'user-3', roomId: 'room-group' },
      ],
    };
    mockPrisma.room.create.mockResolvedValue(room);

    const res = await inject('POST', '/rooms', {
      body: { kind: 'group', title: 'Dev Team', memberIds: ['user-2', 'user-3'] },
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.kind).toBe('group');
    expect(json.title).toBe('Dev Team');
    expect(json.memberIds).toContain('user-1');
    expect(json.memberIds).toContain('user-2');
    expect(json.memberIds).toContain('user-3');
  });
});

describe('GET /rooms', () => {
  it('should only return rooms the user is a member of', async () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const rooms = [
      {
        id: 'room-1',
        kind: 'group',
        title: 'My Room',
        createdAt: now,
        updatedAt: now,
        lastMessagePreview: null,
        lastMessageAt: null,
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            roomId: 'room-1',
            user: { id: 'user-1', handle: 'alice', displayName: 'Alice', avatarUrl: null },
          },
        ],
        pins: [],
        roomTags: [],
      },
    ];
    mockPrisma.room.findMany.mockResolvedValue(rooms);

    const res = await inject('GET', '/rooms');

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe('room-1');

    // Verify query filters by user membership
    const query = mockPrisma.room.findMany.mock.calls[0][0];
    expect(query.where.memberships.some.userId).toBe('user-1');
  });

  it('should use the peer displayName as title for DM rooms without a title', async () => {
    const now = new Date('2025-01-15T12:00:00Z');
    const rooms = [
      {
        id: 'room-dm',
        kind: 'dm',
        title: null,
        createdAt: now,
        updatedAt: now,
        lastMessagePreview: 'Hey!',
        lastMessageAt: now,
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            roomId: 'room-dm',
            user: { id: 'user-1', handle: 'alice', displayName: 'Alice', avatarUrl: null },
          },
          {
            id: 'mem-2',
            userId: 'user-2',
            roomId: 'room-dm',
            user: { id: 'user-2', handle: 'bob', displayName: 'Bob', avatarUrl: null },
          },
        ],
        pins: [],
        roomTags: [],
      },
    ];
    mockPrisma.room.findMany.mockResolvedValue(rooms);

    const res = await inject('GET', '/rooms', { userId: 'user-1' });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    // The DM room title should be the peer's displayName
    expect(json[0].title).toBe('Bob');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /rooms/:id/messages
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /rooms/:id/messages', () => {
  it('should return messages when the user is a member of the room', async () => {
    const membership = createMockMembership({ userId: 'user-1', roomId: 'room-msg' });
    mockPrisma.membership.findUnique.mockResolvedValue(membership);

    const now = new Date('2025-01-15T12:00:00Z');
    const messages = [
      {
        id: 'msg-2',
        clientId: 'client-2',
        roomId: 'room-msg',
        authorId: 'user-2',
        kind: 'text',
        body: 'Hello!',
        mediaUrl: null,
        replyToId: null,
        createdAt: now,
        editedAt: null,
      },
      {
        id: 'msg-1',
        clientId: 'client-1',
        roomId: 'room-msg',
        authorId: 'user-1',
        kind: 'text',
        body: 'Hey there',
        mediaUrl: null,
        replyToId: null,
        createdAt: new Date('2025-01-15T11:59:00Z'),
        editedAt: null,
      },
    ];
    mockPrisma.message.findMany.mockResolvedValue(messages);

    const res = await inject('GET', '/rooms/room-msg/messages');

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe('msg-2');
    expect(json[0].body).toBe('Hello!');
    expect(json[0].status).toBe('delivered');
    expect(json[1].id).toBe('msg-1');
  });

  it('should return 403 when the user is not a member of the room', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const res = await inject('GET', '/rooms/room-forbidden/messages');

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'forbidden' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /rooms — pin & tag metadata
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /rooms — pin & tag metadata', () => {
  it('should return isPinned=false when user has no pin', async () => {
    const now = new Date();
    mockPrisma.room.findMany.mockResolvedValue([
      createMockRoom({
        memberships: [
          { userId: 'user-1', user: { id: 'user-1', handle: 'alice', displayName: 'Alice', avatarUrl: null } },
          { userId: 'user-2', user: { id: 'user-2', handle: 'bob', displayName: 'Bob', avatarUrl: null } },
        ],
        pins: [],
        roomTags: [],
      }),
    ]);

    const res = await inject('GET', '/rooms');
    const json = res.json();
    expect(json[0].isPinned).toBe(false);
    expect(json[0].tags).toEqual([]);
  });

  it('should return isPinned=true when user has a pin', async () => {
    mockPrisma.room.findMany.mockResolvedValue([
      createMockRoom({
        memberships: [
          { userId: 'user-1', user: { id: 'user-1', handle: 'alice', displayName: 'Alice', avatarUrl: null } },
          { userId: 'user-2', user: { id: 'user-2', handle: 'bob', displayName: 'Bob', avatarUrl: null } },
        ],
        pins: [{ userId: 'user-1', roomId: 'room-1' }],
        roomTags: [],
      }),
    ]);

    const res = await inject('GET', '/rooms');
    const json = res.json();
    expect(json[0].isPinned).toBe(true);
  });

  it('should include tags with id, name, color, and numeric createdAt', async () => {
    const tagTime = new Date('2025-06-01T00:00:00Z');
    const tag = createMockTag({ createdAt: tagTime });
    mockPrisma.room.findMany.mockResolvedValue([
      createMockRoom({
        memberships: [
          { userId: 'user-1', user: { id: 'user-1', handle: 'alice', displayName: 'Alice', avatarUrl: null } },
          { userId: 'user-2', user: { id: 'user-2', handle: 'bob', displayName: 'Bob', avatarUrl: null } },
        ],
        pins: [],
        roomTags: [{ tag }],
      }),
    ]);

    const res = await inject('GET', '/rooms');
    const json = res.json();
    expect(json[0].tags).toHaveLength(1);
    expect(json[0].tags[0]).toEqual({
      id: 'tag-1',
      name: 'Work',
      color: '#FF6B6B',
      createdAt: tagTime.getTime(),
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /rooms/:id/pin
// ═══════════════════════════════════════════════════════════════════════════
describe('PUT /rooms/:id/pin', () => {
  it('should return 403 when user is not a member', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const res = await inject('PUT', '/rooms/room-1/pin');
    expect(res.statusCode).toBe(403);
  });

  it('should create a pin when none exists and return pinned=true', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.roomPin.findUnique.mockResolvedValue(null);
    mockPrisma.roomPin.create.mockResolvedValue({ id: 'pin-1', userId: 'user-1', roomId: 'room-1' });

    const res = await inject('PUT', '/rooms/room-1/pin');
    expect(res.statusCode).toBe(200);
    expect(res.json().pinned).toBe(true);
    expect(mockPrisma.roomPin.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roomId: 'room-1' },
    });
  });

  it('should remove a pin when one exists and return pinned=false', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.roomPin.findUnique.mockResolvedValue({ id: 'pin-1', userId: 'user-1', roomId: 'room-1' });
    mockPrisma.roomPin.delete.mockResolvedValue({});

    const res = await inject('PUT', '/rooms/room-1/pin');
    expect(res.statusCode).toBe(200);
    expect(res.json().pinned).toBe(false);
    expect(mockPrisma.roomPin.delete).toHaveBeenCalledWith({ where: { id: 'pin-1' } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /rooms/:id (leave room)
// ═══════════════════════════════════════════════════════════════════════════
describe('DELETE /rooms/:id', () => {
  it('should delete membership, pin, room tags and return 204', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      createMockRoom({ kind: 'group', memberships: [{ userId: 'user-1' }, { userId: 'user-2' }] }),
    );

    const res = await inject('DELETE', '/rooms/room-1');
    expect(res.statusCode).toBe(204);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.membership.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.roomPin.deleteMany).toHaveBeenCalled();
    expect(mockPrisma.roomTag.deleteMany).toHaveBeenCalled();
  });

  it('should delete the ConnectionRequest when leaving a DM room', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      createMockRoom({ kind: 'dm', memberships: [{ userId: 'user-1' }, { userId: 'user-2' }] }),
    );

    const res = await inject('DELETE', '/rooms/room-1');
    expect(res.statusCode).toBe(204);
    expect(mockPrisma.connectionRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { senderId: 'user-1', receiverId: 'user-2' },
          { senderId: 'user-2', receiverId: 'user-1' },
        ],
      },
    });
  });

  it('should NOT delete ConnectionRequest when leaving a group room', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(
      createMockRoom({ kind: 'group', memberships: [{ userId: 'user-1' }, { userId: 'user-2' }, { userId: 'user-3' }] }),
    );

    const res = await inject('DELETE', '/rooms/room-1');
    expect(res.statusCode).toBe(204);
    expect(mockPrisma.connectionRequest.deleteMany).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /rooms/:id/tags
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /rooms/:id/tags', () => {
  it('should return 400 for missing tagId', async () => {
    const res = await inject('POST', '/rooms/room-1/tags', { body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('should return 403 when user is not a room member', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const res = await inject('POST', '/rooms/room-1/tags', { body: { tagId: 'tag-1' } });
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 when tag belongs to another user', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag({ userId: 'other-user' }));

    const res = await inject('POST', '/rooms/room-1/tags', { body: { tagId: 'tag-1' } });
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 when tag does not exist', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await inject('POST', '/rooms/room-1/tags', { body: { tagId: 'nonexistent' } });
    expect(res.statusCode).toBe(403);
  });

  it('should upsert room-tag and return 201 when valid', async () => {
    mockPrisma.membership.findUnique.mockResolvedValue(createMockMembership());
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag());
    mockPrisma.roomTag.upsert.mockResolvedValue({});

    const res = await inject('POST', '/rooms/room-1/tags', { body: { tagId: 'tag-1' } });
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.roomTag.upsert).toHaveBeenCalledWith({
      where: { roomId_tagId: { roomId: 'room-1', tagId: 'tag-1' } },
      create: { roomId: 'room-1', tagId: 'tag-1' },
      update: {},
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /rooms/:id/tags/:tagId
// ═══════════════════════════════════════════════════════════════════════════
describe('DELETE /rooms/:id/tags/:tagId', () => {
  it('should return 403 when tag does not belong to user', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag({ userId: 'other-user' }));

    const res = await inject('DELETE', '/rooms/room-1/tags/tag-1');
    expect(res.statusCode).toBe(403);
  });

  it('should return 403 when tag does not exist', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const res = await inject('DELETE', '/rooms/room-1/tags/tag-1');
    expect(res.statusCode).toBe(403);
  });

  it('should delete room-tag and return 204 when valid', async () => {
    mockPrisma.tag.findUnique.mockResolvedValue(createMockTag());
    mockPrisma.roomTag.deleteMany.mockResolvedValue({ count: 1 });

    const res = await inject('DELETE', '/rooms/room-1/tags/tag-1');
    expect(res.statusCode).toBe(204);
    expect(mockPrisma.roomTag.deleteMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1', tagId: 'tag-1' },
    });
  });
});
