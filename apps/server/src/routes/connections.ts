import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ConnectionRequest as PrismaConnectionRequest, User as PrismaUser } from '@prisma/client';

import {
  EventNames,
  SendConnectionRequestSchema,
  type ConnectionRequestWithUser,
  type ConnectionRequest,
  type Room,
  type User,
  type SendConnectionAlreadyConnected,
  type SendConnectionCreated,
  type AcceptConnectionResponse,
  type IgnoreConnectionResponse,
  type ConnectionPeer,
  type SentConnectionRequestWithUser,
  type RevokeConnectionResponse,
} from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';
import { getIO, getUserSockets } from '../sockets/chat';

// ── Prisma result types used by shapers ─────────────────────────────────────

type PrismaUserSelect = Pick<PrismaUser, 'id' | 'handle' | 'displayName' | 'avatarUrl' | 'createdAt'>;

type PrismaRequestWithSender = PrismaConnectionRequest & {
  sender: PrismaUserSelect;
};

type PrismaRequestWithReceiver = PrismaConnectionRequest & {
  receiver: PrismaUserSelect;
};

export async function connectionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /** Send a connection request to another user. */
  app.post('/connections/request', async (req, reply) => {
    const userId = req.user!.sub;
    const body = SendConnectionRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    if (body.data.receiverId === userId) {
      return reply.code(400).send({ error: 'cannot_request_self' });
    }

    // Check if a DM room already exists between these two users
    const existingRoom = await prisma.room.findFirst({
      where: {
        kind: 'dm',
        AND: [
          { memberships: { some: { userId } } },
          { memberships: { some: { userId: body.data.receiverId } } },
        ],
      },
      include: { memberships: true },
    });

    if (existingRoom) {
      const response: SendConnectionAlreadyConnected = {
        alreadyConnected: true,
        room: {
          id: existingRoom.id,
          kind: existingRoom.kind,
          title: existingRoom.title,
          createdAt: existingRoom.createdAt.getTime(),
          updatedAt: existingRoom.updatedAt.getTime(),
          lastMessagePreview: existingRoom.lastMessagePreview,
          lastMessageAt: existingRoom.lastMessageAt?.getTime() ?? null,
          memberIds: existingRoom.memberships.map((m) => m.userId),
        },
      };
      return reply.code(200).send(response);
    }

    // Check for existing request in either direction
    const existing = await prisma.connectionRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: body.data.receiverId },
          { senderId: body.data.receiverId, receiverId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'pending' && existing.receiverId === userId) {
        // They already sent us a request — auto-accept
        return acceptRequest(existing.id, userId, reply);
      }
      if (existing.status === 'accepted') {
        return reply.code(409).send({ error: 'already_connected' });
      }
      if (existing.status === 'pending') {
        return reply.code(409).send({ error: 'request_already_sent' });
      }
      // If ignored, allow re-sending by updating
      await prisma.connectionRequest.update({
        where: { id: existing.id },
        data: { senderId: userId, receiverId: body.data.receiverId, status: 'pending', message: body.data.message ?? null },
      });
      const updated = await prisma.connectionRequest.findUnique({
        where: { id: existing.id },
        include: { sender: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } } },
      });

      // Notify receiver via socket (was missing for re-sent requests after ignore)
      const io = getIO();
      if (io) {
        io.to(`user:${body.data.receiverId}`).emit(EventNames.ConnectionRequestNew, {
          request: shapeRequestWithUser(updated!),
        });
      }

      const response: SendConnectionCreated = { request: shapeRequestWithUser(updated!) };
      return reply.code(201).send(response);
    }

    const request = await prisma.connectionRequest.create({
      data: {
        senderId: userId,
        receiverId: body.data.receiverId,
        message: body.data.message ?? null,
      },
      include: { sender: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } } },
    });

    // Notify receiver via socket
    const io = getIO();
    if (io) {
      io.to(`user:${body.data.receiverId}`).emit(EventNames.ConnectionRequestNew, {
        request: shapeRequestWithUser(request),
      });
    }

    const response: SendConnectionCreated = { request: shapeRequestWithUser(request) };
    return reply.code(201).send(response);
  });

  /** List pending connection requests received by the current user. */
  app.get('/connections/pending', async (req, reply) => {
    const userId = req.user!.sub;
    const requests = await prisma.connectionRequest.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: { sender: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const response: ConnectionRequestWithUser[] = requests.map(shapeRequestWithUser);
    return reply.send(response);
  });

  /** Accept a connection request — creates a DM room. */
  app.post<{ Params: { id: string } }>('/connections/:id/accept', async (req, reply) => {
    const userId = req.user!.sub;
    return acceptRequest(req.params.id, userId, reply);
  });

  /** Ignore a connection request — hard-deletes the record so both users
   *  can discover each other and reconnect later. */
  app.post<{ Params: { id: string } }>('/connections/:id/ignore', async (req, reply) => {
    const userId = req.user!.sub;
    const request = await prisma.connectionRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.receiverId !== userId) {
      return reply.code(404).send({ error: 'not_found' });
    }
    await prisma.connectionRequest.delete({ where: { id: request.id } });

    // Notify sender so they remove the request from their sent list.
    // Use a neutral event name ("expired") so the sender doesn't know
    // the request was explicitly ignored.
    const io = getIO();
    if (io) {
      io.to(`user:${request.senderId}`).emit(EventNames.ConnectionRequestExpired, {
        requestId: request.id,
      });
    }

    const response: IgnoreConnectionResponse = { success: true };
    return reply.send(response);
  });

  /** List pending connection requests sent by the current user. */
  app.get('/connections/sent', async (req, reply) => {
    const userId = req.user!.sub;
    const requests = await prisma.connectionRequest.findMany({
      where: { senderId: userId, status: 'pending' },
      include: { receiver: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const response: SentConnectionRequestWithUser[] = requests.map(shapeRequestWithReceiver);
    return reply.send(response);
  });

  /** Revoke (cancel) a sent connection request. Hard-deletes the row. */
  app.post<{ Params: { id: string } }>('/connections/:id/revoke', async (req, reply) => {
    const userId = req.user!.sub;
    const request = await prisma.connectionRequest.findUnique({ where: { id: req.params.id } });

    if (!request || request.senderId !== userId) {
      return reply.code(404).send({ error: 'not_found' });
    }
    if (request.status !== 'pending') {
      return reply.code(409).send({ error: 'not_pending' });
    }

    await prisma.connectionRequest.delete({ where: { id: request.id } });

    // Notify receiver via socket
    const io = getIO();
    if (io) {
      io.to(`user:${request.receiverId}`).emit(EventNames.ConnectionRequestRevoked, {
        requestId: request.id,
      });
    }

    const response: RevokeConnectionResponse = { success: true };
    return reply.send(response);
  });

  /** List all accepted connections for the current user with the associated rooms. */
  app.get('/connections', async (req, reply) => {
    const userId = req.user!.sub;
    const connections = await prisma.connectionRequest.findMany({
      where: {
        status: 'accepted',
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } },
        receiver: { select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const response: ConnectionPeer[] = connections.map((c) => ({
      id: c.id,
      peer: c.senderId === userId ? shapeUser(c.receiver) : shapeUser(c.sender),
      createdAt: c.createdAt.getTime(),
    }));
    return reply.send(response);
  });
}

async function acceptRequest(requestId: string, userId: string, reply: FastifyReply) {
  const request = await prisma.connectionRequest.findUnique({ where: { id: requestId } });
  if (!request || request.receiverId !== userId) {
    return reply.code(404).send({ error: 'not_found' });
  }
  if (request.status === 'accepted') {
    return reply.code(409).send({ error: 'already_accepted' });
  }

  // Create DM room + accept in a transaction.
  // Re-read status inside tx to guard against concurrent double-accept.
  // Also check for existing DM room to prevent duplicates.
  const txResult = await prisma.$transaction(async (tx) => {
    // Re-read the request inside the transaction for isolation
    const freshRequest = await tx.connectionRequest.findUnique({ where: { id: request.id } });
    if (!freshRequest || freshRequest.status === 'accepted') {
      throw new Error('ALREADY_ACCEPTED');
    }

    // Prevent duplicate DM rooms between this pair
    const existingRoom = await tx.room.findFirst({
      where: {
        kind: 'dm',
        AND: [
          { memberships: { some: { userId: request.senderId } } },
          { memberships: { some: { userId: request.receiverId } } },
        ],
      },
      include: { memberships: true },
    });

    if (existingRoom) {
      // Room already exists (race condition). Just mark accepted and return existing room.
      const updated = await tx.connectionRequest.update({
        where: { id: request.id },
        data: { status: 'accepted' },
      });
      return { updatedRequest: updated, room: existingRoom };
    }

    const updated = await tx.connectionRequest.update({
      where: { id: request.id },
      data: { status: 'accepted' },
    });

    const newRoom = await tx.room.create({
      data: {
        kind: 'dm',
        memberships: {
          create: [{ userId: request.senderId }, { userId: request.receiverId }],
        },
        // Seed with the initial message if provided
        ...(request.message
          ? { lastMessagePreview: request.message, lastMessageAt: new Date() }
          : {}),
      },
      include: { memberships: true },
    });

    // If there was an initial message, create it
    if (request.message) {
      const crypto = await import('crypto');
      await tx.message.create({
        data: {
          clientId: crypto.randomUUID(),
          roomId: newRoom.id,
          authorId: request.senderId,
          kind: 'text',
          body: request.message,
        },
      });
    }

    return { updatedRequest: updated, room: newRoom };
  }).catch((err: Error) => {
    if (err.message === 'ALREADY_ACCEPTED') return null;
    throw err;
  });

  if (!txResult) {
    return reply.code(409).send({ error: 'already_accepted' });
  }

  const { updatedRequest, room } = txResult;

  const roomPayload: Room = {
    id: room.id,
    kind: room.kind,
    title: room.title,
    createdAt: room.createdAt.getTime(),
    updatedAt: room.updatedAt.getTime(),
    lastMessagePreview: room.lastMessagePreview,
    lastMessageAt: room.lastMessageAt?.getTime() ?? null,
    memberIds: room.memberships.map((m) => m.userId),
  };

  // Notify both parties via socket about the new room
  const io = getIO();
  if (io) {
    // Join both users' active sockets into the new room so messages
    // are delivered in realtime immediately after acceptance.
    const sockets = getUserSockets();
    for (const uid of [request.senderId, request.receiverId]) {
      const socketIds = sockets.get(uid);
      if (socketIds) {
        for (const sid of socketIds) {
          const sock = io.sockets.sockets.get(sid);
          if (sock) void sock.join(`room:${room.id}`);
        }
      }
    }

    io.to(`user:${request.senderId}`).emit(EventNames.ConnectionAccepted, {
      requestId: request.id,
      room: roomPayload,
    });
    io.to(`user:${request.receiverId}`).emit(EventNames.ConnectionAccepted, {
      requestId: request.id,
      room: roomPayload,
    });
  }

  const response: AcceptConnectionResponse = {
    request: {
      id: updatedRequest.id,
      senderId: updatedRequest.senderId,
      receiverId: updatedRequest.receiverId,
      status: 'accepted',
      message: updatedRequest.message,
      createdAt: updatedRequest.createdAt.getTime(),
    },
    room: roomPayload,
  };
  return reply.send(response);
}

function shapeRequestWithUser(r: PrismaRequestWithSender): ConnectionRequestWithUser {
  return {
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    status: r.status as ConnectionRequestWithUser['status'],
    message: r.message,
    createdAt: r.createdAt.getTime(),
    sender: shapeUser(r.sender),
  };
}

function shapeRequestWithReceiver(r: PrismaRequestWithReceiver): SentConnectionRequestWithUser {
  return {
    id: r.id,
    senderId: r.senderId,
    receiverId: r.receiverId,
    status: r.status as SentConnectionRequestWithUser['status'],
    message: r.message,
    createdAt: r.createdAt.getTime(),
    receiver: shapeUser(r.receiver),
  };
}

function shapeUser(u: PrismaUserSelect): User {
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.getTime(),
  };
}
