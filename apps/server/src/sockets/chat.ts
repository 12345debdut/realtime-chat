/**
 * Socket.IO chat namespace.
 *
 * Auth: the client sends the access token as `socket.handshake.auth.token`.
 *       A middleware verifies the JWT before the connection is accepted.
 * Rooms: clients join per-chat rooms with `room:join` so broadcasts stay
 *        scoped to the participants.
 * Presence: an ephemeral Redis key with a TTL tracks last-seen; pub/sub
 *        broadcasts online/offline transitions (wired minimally here).
 */
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, type Socket } from 'socket.io';

import {
  C2S_MessageDeleteSchema,
  C2S_MessageSendSchema,
  C2S_ReadReceiptSchema,
  C2S_RoomJoinSchema,
  C2S_RoomLeaveSchema,
  C2S_TypingStartSchema,
  C2S_TypingStopSchema,
  EventNames,
  type Message,
  type S2C_MessageAck,
  type S2C_MessageDeleted,
  type S2C_MessageFail,
  type S2C_MessageNew,
} from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { pubClient, redis, subClient } from '../lib/redis';
import { verifyAccess, type AccessPayload } from '../lib/tokens';

interface SocketData {
  user: AccessPayload;
}

/**
 * Redis presence TTL — safety net for container crashes.
 * If a container dies without clean disconnect, the key auto-expires.
 * Under normal operation, we explicitly `del` on disconnect.
 */
/** Redis TTL for presence keys. Must be > client heartbeat interval (30s).
 *  Set to 3× heartbeat so 1–2 missed beats don't cause a false offline. */
const PRESENCE_TTL_SEC = 90;

// Shorthand for the loosely-typed socket we operate on. The Zod schemas at
// the edges give us the real guarantees; fighting Socket.IO's generics here
// buys us nothing.
type ChatSocket = Socket & { data: SocketData };

/** Map userId → Set<socketId> for targeted pushes from REST routes. */
const userSockets = new Map<string, Set<string>>();

/** Get the Socket.IO server instance (available after attachChatSockets). */
let ioInstance: Server | null = null;
export function getIO(): Server | null {
  return ioInstance;
}
export function getUserSockets(): Map<string, Set<string>> {
  return userSockets;
}

export function attachChatSockets(http: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const io = new Server(http as any, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) return next(new Error('missing_token'));
    try {
      (socket.data as SocketData).user = verifyAccess(token);
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  ioInstance = io;

  io.on('connection', (anySocket) => {
    const socket = anySocket as ChatSocket;
    const userId = socket.data.user.sub;
    void markOnline(userId);

    // Track user → socket mapping for targeted pushes
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);
    // Join a personal room so REST handlers can emit to `user:{userId}`
    void socket.join(`user:${userId}`);

    // NOTE: We do NOT broadcast presence on connect — the socket hasn't
    // joined any rooms yet, so io.to('room:X').emit() would reach nobody.
    // Instead, presence is exchanged inside room:join (below).

    socket.on('disconnect', () => {
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(userId);
          // Only mark offline when the last socket disconnects
          void markOffline(userId);
          void broadcastPresence(io, userId, false);
        }
      }
    });

    // ── Room membership ────────────────────────────────────────────────
    socket.on(EventNames.RoomJoin, async (raw: unknown) => {
      const parsed = C2S_RoomJoinSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId } = parsed.data;
      // Verify user is a member of the room before allowing join
      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId } },
      });
      if (!membership) return;
      await socket.join(`room:${roomId}`);

      // 1) Tell OTHER members in this room that this user is online.
      //    (This replaces the old broadcastPresence on connect, which
      //     fired before the socket had joined any rooms.)
      socket.to(`room:${roomId}`).emit(EventNames.Presence, {
        userId,
        online: true,
        lastSeenAt: null,
      });

      // 2) Tell THIS user about the current presence of other members.
      //    Uses Redis as source of truth (heartbeat-refreshed TTL keys).
      try {
        const members = await prisma.membership.findMany({
          where: { roomId },
          select: { userId: true },
        });
        for (const m of members) {
          if (m.userId === userId) continue;
          const alive = await redis.exists(`presence:${m.userId}`);
          socket.emit(EventNames.Presence, {
            userId: m.userId,
            online: !!alive,
            lastSeenAt: alive ? null : Date.now(),
          });
        }
      } catch {
        // best-effort
      }
    });

    socket.on(EventNames.RoomLeave, async (raw: unknown) => {
      const parsed = C2S_RoomLeaveSchema.safeParse(raw);
      if (!parsed.success) return;
      await socket.leave(`room:${parsed.data.roomId}`);
    });

    // ── Message send (core hot path) ───────────────────────────────────
    socket.on(EventNames.MessageSend, async (raw: unknown) => {
      const parsed = C2S_MessageSendSchema.safeParse(raw);
      if (!parsed.success) {
        const fail: S2C_MessageFail = {
          clientId: (raw as { clientId?: string })?.clientId ?? 'unknown',
          reason: 'invalid_payload',
        };
        socket.emit(EventNames.MessageFail, fail);
        return;
      }

      const input = parsed.data;

      // Enforce: user must be a member of the target room.
      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId: input.roomId } },
      });
      if (!membership) {
        socket.emit(EventNames.MessageFail, { clientId: input.clientId, reason: 'forbidden' });
        return;
      }

      try {
        // Idempotent on clientId — re-emits from the outbox are safe.
        const message = await prisma.message.upsert({
          where: { clientId: input.clientId },
          create: {
            clientId: input.clientId,
            roomId: input.roomId,
            authorId: userId,
            kind: input.kind,
            body: input.body,
            mediaUrl: input.mediaUrl ?? null,
            replyToId: input.replyToId ?? null,
          },
          update: {}, // no-op on retry
        });

        await prisma.room.update({
          where: { id: input.roomId },
          data: {
            lastMessagePreview: input.body.slice(0, 280),
            lastMessageAt: message.createdAt,
          },
        });

        const ack: S2C_MessageAck = {
          clientId: message.clientId,
          serverId: message.id,
          createdAt: message.createdAt.getTime(),
        };
        socket.emit(EventNames.MessageAck, ack);

        const payload: S2C_MessageNew = {
          message: shapeMessage(message),
        };
        // Broadcast to everyone in the room — including sender, so other
        // devices of the same user reconcile the optimistic row.
        io.to(`room:${input.roomId}`).emit(EventNames.MessageNew, payload);
      } catch (err) {
        const fail: S2C_MessageFail = {
          clientId: input.clientId,
          reason: (err as Error).message ?? 'server_error',
        };
        socket.emit(EventNames.MessageFail, fail);
      }
    });

    // ── Typing indicators ──────────────────────────────────────────────
    socket.on(EventNames.TypingStart, async (raw: unknown) => {
      const parsed = C2S_TypingStartSchema.safeParse(raw);
      if (!parsed.success) return;
      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId: parsed.data.roomId } },
      });
      if (!membership) return;
      socket.to(`room:${parsed.data.roomId}`).emit(EventNames.Typing, {
        roomId: parsed.data.roomId,
        userId,
        typing: true,
      });
    });
    socket.on(EventNames.TypingStop, async (raw: unknown) => {
      const parsed = C2S_TypingStopSchema.safeParse(raw);
      if (!parsed.success) return;
      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId: parsed.data.roomId } },
      });
      if (!membership) return;
      socket.to(`room:${parsed.data.roomId}`).emit(EventNames.Typing, {
        roomId: parsed.data.roomId,
        userId,
        typing: false,
      });
    });

    // ── Heartbeat — client sends every 30s, we refresh the Redis TTL ─
    socket.on(EventNames.Heartbeat, () => {
      void markOnline(userId);
    });

    // ── Message delete (soft-delete) ─────────────────────────────────
    socket.on(EventNames.MessageDelete, async (raw: unknown) => {
      const parsed = C2S_MessageDeleteSchema.safeParse(raw);
      if (!parsed.success) return;
      const { messageId, roomId } = parsed.data;

      try {
        // Only the author can delete their own message
        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message || message.authorId !== userId || message.roomId !== roomId) return;

        const now = new Date();
        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt: now, body: '' },
        });

        const payload: S2C_MessageDeleted = {
          messageId,
          roomId,
          deletedAt: now.getTime(),
        };
        io.to(`room:${roomId}`).emit(EventNames.MessageDeleted, payload);
      } catch {
        // best-effort — don't crash the socket handler
      }
    });

    // ── Read receipts ──────────────────────────────────────────────────
    socket.on(EventNames.ReadReceipt, async (raw: unknown) => {
      const parsed = C2S_ReadReceiptSchema.safeParse(raw);
      if (!parsed.success) return;
      // Verify membership before updating read receipt
      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId: parsed.data.roomId } },
      });
      if (!membership) return;
      await prisma.membership.update({
        where: { userId_roomId: { userId, roomId: parsed.data.roomId } },
        data: { lastReadMessageId: parsed.data.upToMessageId },
      });
      io.to(`room:${parsed.data.roomId}`).emit(EventNames.ReadReceiptBroadcast, {
        roomId: parsed.data.roomId,
        userId,
        upToMessageId: parsed.data.upToMessageId,
        at: Date.now(),
      });
    });
  });

  return io;
}

async function markOnline(userId: string) {
  await redis.set(`presence:${userId}`, Date.now().toString(), 'EX', PRESENCE_TTL_SEC);
}
async function markOffline(userId: string) {
  await redis.del(`presence:${userId}`);
}

/**
 * Broadcast a presence event to every room this user belongs to.
 * Uses the DB to find all memberships, then emits to each room.
 */
async function broadcastPresence(io: Server, userId: string, online: boolean) {
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { roomId: true },
    });
    const payload = {
      userId,
      online,
      lastSeenAt: online ? null : Date.now(),
    };
    for (const m of memberships) {
      io.to(`room:${m.roomId}`).emit(EventNames.Presence, payload);
    }
  } catch {
    // best-effort — don't crash the socket handler
  }
}

function shapeMessage(m: {
  id: string;
  clientId: string;
  roomId: string;
  authorId: string;
  kind: 'text' | 'image' | 'system';
  body: string;
  mediaUrl: string | null;
  replyToId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}): Message {
  return {
    id: m.id,
    clientId: m.clientId,
    roomId: m.roomId,
    authorId: m.authorId,
    kind: m.kind,
    body: m.deletedAt ? '' : m.body,
    mediaUrl: m.deletedAt ? null : m.mediaUrl,
    replyToId: m.replyToId,
    status: 'delivered',
    createdAt: m.createdAt.getTime(),
    editedAt: m.editedAt?.getTime() ?? null,
    deletedAt: m.deletedAt?.getTime() ?? null,
  };
}
