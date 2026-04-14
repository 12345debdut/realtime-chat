import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import './helpers';
import {
  buildTestApp,
  createMockConnectionRequest,
  createMockRoom,
  createMockUser,
} from './helpers';
import { prisma } from '../lib/prisma';
import { getIO, getUserSockets } from '../sockets/chat';
import { connectionRoutes } from '../routes/connections';

// ── Typed references to the mocked prisma models ───────────────────────────
const mockPrisma = prisma as any;
const mockGetIO = getIO as ReturnType<typeof vi.fn>;
const mockGetUserSockets = getUserSockets as ReturnType<typeof vi.fn>;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp(connectionRoutes);
});

afterAll(async () => {
  await app.close();
});

function inject(
  method: 'GET' | 'POST',
  url: string,
  opts: { userId?: string; body?: any } = {},
) {
  const headers: Record<string, string> = {
    'x-test-user-id': opts.userId ?? 'user-1',
    'x-test-user-handle': 'testuser',
  };
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

// ── Reset all mocks between tests ──────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockGetIO.mockReturnValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /connections/request
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/request', () => {
  it('should create a new connection request and return 201', async () => {
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.connectionRequest.findFirst.mockResolvedValue(null);

    const sender = createMockUser({ id: 'user-1' });
    const created = createMockConnectionRequest({
      senderId: 'user-1',
      receiverId: 'user-2',
      sender,
    });
    mockPrisma.connectionRequest.create.mockResolvedValue(created);

    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-2' },
    });

    expect(res.statusCode).toBe(201);
    const json = res.json();
    expect(json.request).toBeDefined();
    expect(json.request.senderId).toBe('user-1');
    expect(json.request.receiverId).toBe('user-2');
  });

  it('should return 400 when sending a request to self', async () => {
    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-1' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('cannot_request_self');
  });

  it('should return 409 when a pending request already exists from sender', async () => {
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.connectionRequest.findFirst.mockResolvedValue(
      createMockConnectionRequest({
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'pending',
      }),
    );

    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-2' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('request_already_sent');
  });

  it('should return existing room when users are already connected via DM', async () => {
    const room = createMockRoom({
      id: 'room-existing',
      kind: 'dm',
      memberships: [
        { id: 'mem-1', userId: 'user-1', roomId: 'room-existing' },
        { id: 'mem-2', userId: 'user-2', roomId: 'room-existing' },
      ],
    });
    mockPrisma.room.findFirst.mockResolvedValue(room);

    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-2' },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.alreadyConnected).toBe(true);
    expect(json.room.id).toBe('room-existing');
    expect(json.room.memberIds).toContain('user-1');
    expect(json.room.memberIds).toContain('user-2');
  });

  it('should auto-accept when receiver already has a pending request from sender (mutual request)', async () => {
    // user-1 sends request, but user-2 already sent one to user-1 (pending)
    // So existing.receiverId === userId (user-1), triggers auto-accept
    mockPrisma.room.findFirst.mockResolvedValue(null);
    const existingRequest = createMockConnectionRequest({
      id: 'conn-req-mutual',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'pending',
      message: null,
    });
    mockPrisma.connectionRequest.findFirst.mockResolvedValue(existingRequest);

    // Mock the acceptRequest flow
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(existingRequest);

    const room = createMockRoom({ id: 'room-mutual' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      // Simulate the transaction
      const tx = mockPrisma;
      return fn(tx);
    });

    // Inside the transaction: fresh read, update, room create
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(existingRequest);
    mockPrisma.connectionRequest.update.mockResolvedValue({
      ...existingRequest,
      status: 'accepted',
    });
    // No existing DM room inside tx
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue(room);

    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-2' },
    });

    // Auto-accept returns the AcceptConnectionResponse shape (200 by default from reply.send)
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.room).toBeDefined();
    expect(json.request.status).toBe('accepted');
  });

  it('should allow sending a fresh request after previous one was ignored/deleted (201)', async () => {
    // After ignore, the ConnectionRequest is hard-deleted — no existing record
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.connectionRequest.findFirst.mockResolvedValue(null);

    const sender = createMockUser({ id: 'user-1' });
    const newRequest = createMockConnectionRequest({
      id: 'conn-req-fresh',
      senderId: 'user-1',
      receiverId: 'user-2',
      status: 'pending',
      sender,
    });
    mockPrisma.connectionRequest.create.mockResolvedValue(newRequest);

    const res = await inject('POST', '/connections/request', {
      userId: 'user-1',
      body: { receiverId: 'user-2' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().request.senderId).toBe('user-1');
    expect(mockPrisma.connectionRequest.create).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /connections/:id/accept
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/:id/accept', () => {
  it('should accept a pending request and create a DM room', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-accept',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);

    const room = createMockRoom({ id: 'room-new-dm' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = mockPrisma;
      return fn(tx);
    });
    // Fresh read inside tx
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);
    mockPrisma.connectionRequest.update.mockResolvedValue({
      ...request,
      status: 'accepted',
    });
    mockPrisma.room.findFirst.mockResolvedValue(null); // no existing DM
    mockPrisma.room.create.mockResolvedValue(room);

    const res = await inject('POST', '/connections/conn-accept/accept', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.request.status).toBe('accepted');
    expect(json.room).toBeDefined();
    expect(json.room.id).toBe('room-new-dm');
  });

  it('should return 409 when request is already accepted', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-already',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'accepted',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);

    const res = await inject('POST', '/connections/conn-already/accept', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('already_accepted');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /connections/:id/ignore
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/:id/ignore', () => {
  it('should delete the connection request on ignore', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-ignore',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);
    mockPrisma.connectionRequest.delete.mockResolvedValue(request);

    const res = await inject('POST', '/connections/conn-ignore/ignore', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(mockPrisma.connectionRequest.delete).toHaveBeenCalledWith({
      where: { id: 'conn-ignore' },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /connections/:id/revoke
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/:id/revoke', () => {
  it('should revoke a valid pending request sent by the user and emit socket event', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-revoke',
      senderId: 'user-1',
      receiverId: 'user-2',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);
    mockPrisma.connectionRequest.delete.mockResolvedValue(request);

    const emitMock = vi.fn();
    const toMock = vi.fn(() => ({ emit: emitMock }));
    mockGetIO.mockReturnValue({ to: toMock });

    const res = await inject('POST', '/connections/conn-revoke/revoke', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(toMock).toHaveBeenCalledWith('user:user-2');
    expect(emitMock).toHaveBeenCalledWith('connection:request:revoked', {
      requestId: 'conn-revoke',
    });
  });

  it('should return 409 when request is not pending', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-revoke-accepted',
      senderId: 'user-1',
      receiverId: 'user-2',
      status: 'accepted',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);

    const res = await inject('POST', '/connections/conn-revoke-accepted/revoke', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('not_pending');
  });

  it('should return 404 when user is not the sender', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-revoke-other',
      senderId: 'user-2',
      receiverId: 'user-3',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);

    const res = await inject('POST', '/connections/conn-revoke-other/revoke', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /connections/pending
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /connections/pending', () => {
  it('should return pending requests received by the current user', async () => {
    const sender = createMockUser({ id: 'user-2', handle: 'bob', displayName: 'Bob' });
    const requests = [
      createMockConnectionRequest({
        id: 'req-1',
        senderId: 'user-2',
        receiverId: 'user-1',
        status: 'pending',
        sender,
      }),
    ];
    mockPrisma.connectionRequest.findMany.mockResolvedValue(requests);

    const res = await inject('GET', '/connections/pending', { userId: 'user-1' });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    expect(json[0].senderId).toBe('user-2');
    expect(json[0].sender).toBeDefined();
    expect(json[0].sender.handle).toBe('bob');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /connections/sent
// ═══════════════════════════════════════════════════════════════════════════
describe('GET /connections/sent', () => {
  it('should return pending requests sent by the current user', async () => {
    const receiver = createMockUser({ id: 'user-2', handle: 'bob', displayName: 'Bob' });
    const requests = [
      createMockConnectionRequest({
        id: 'sent-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'pending',
        receiver,
      }),
    ];
    mockPrisma.connectionRequest.findMany.mockResolvedValue(requests);

    const res = await inject('GET', '/connections/sent', { userId: 'user-1' });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveLength(1);
    expect(json[0].receiverId).toBe('user-2');
    expect(json[0].receiver).toBeDefined();
    expect(json[0].receiver.handle).toBe('bob');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap 1: Accept joins both users' sockets to the new room
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/:id/accept — socket.join', () => {
  it('should join both users\' active sockets to the new room on accept', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-join',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);

    const room = createMockRoom({ id: 'room-join-test' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = mockPrisma;
      return fn(tx);
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);
    mockPrisma.connectionRequest.update.mockResolvedValue({
      ...request,
      status: 'accepted',
    });
    mockPrisma.room.findFirst.mockResolvedValue(null);
    mockPrisma.room.create.mockResolvedValue(room);

    // Mock sockets for both users
    const joinMockSender = vi.fn();
    const joinMockReceiver = vi.fn();

    const userSocketsMap = new Map<string, Set<string>>();
    userSocketsMap.set('user-2', new Set(['socket-sender-1']));
    userSocketsMap.set('user-1', new Set(['socket-receiver-1', 'socket-receiver-2']));
    mockGetUserSockets.mockReturnValue(userSocketsMap);

    const socketMap = new Map<string, { join: ReturnType<typeof vi.fn> }>();
    socketMap.set('socket-sender-1', { join: joinMockSender });
    socketMap.set('socket-receiver-1', { join: joinMockReceiver });
    socketMap.set('socket-receiver-2', { join: joinMockReceiver });

    const emitMock = vi.fn();
    const toMock = vi.fn(() => ({ emit: emitMock }));
    mockGetIO.mockReturnValue({
      to: toMock,
      sockets: { sockets: { get: (id: string) => socketMap.get(id) ?? null } },
    });

    const res = await inject('POST', '/connections/conn-join/accept', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(200);

    // Sender's socket should have joined the room
    expect(joinMockSender).toHaveBeenCalledWith('room:room-join-test');

    // Receiver's sockets (both) should have joined the room
    expect(joinMockReceiver).toHaveBeenCalledWith('room:room-join-test');
    expect(joinMockReceiver).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap 2: Ignore emits connection:request:expired to sender
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /connections/:id/ignore — expired event', () => {
  it('should emit connection:request:expired to the sender when a request is ignored', async () => {
    const request = createMockConnectionRequest({
      id: 'conn-ignore-expired',
      senderId: 'user-2',
      receiverId: 'user-1',
      status: 'pending',
    });
    mockPrisma.connectionRequest.findUnique.mockResolvedValue(request);
    mockPrisma.connectionRequest.delete.mockResolvedValue(request);

    const emitMock = vi.fn();
    const toMock = vi.fn(() => ({ emit: emitMock }));
    mockGetIO.mockReturnValue({ to: toMock });

    const res = await inject('POST', '/connections/conn-ignore-expired/ignore', {
      userId: 'user-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);

    // Verify the neutral "expired" event is emitted to the sender
    expect(toMock).toHaveBeenCalledWith('user:user-2');
    expect(emitMock).toHaveBeenCalledWith('connection:request:expired', {
      requestId: 'conn-ignore-expired',
    });
  });
});
