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
  C2S_MessageSendSchema,
  C2S_ReadReceiptSchema,
  C2S_RoomJoinSchema,
  C2S_RoomLeaveSchema,
  C2S_TypingStartSchema,
  C2S_TypingStopSchema,
  EventNames,
  type Message,
  type S2C_MessageAck,
  type S2C_MessageFail,
  type S2C_MessageNew,
} from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { pubClient, redis, subClient } from '../lib/redis';
import { verifyAccess, type AccessPayload } from '../lib/tokens';

interface SocketData {
  user: AccessPayload;
}

const PRESENCE_TTL_SEC = 30;

// Shorthand for the loosely-typed socket we operate on. The Zod schemas at
// the edges give us the real guarantees; fighting Socket.IO's generics here
// buys us nothing.
type ChatSocket = Socket & { data: SocketData };

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

  io.on('connection', (anySocket) => {
    const socket = anySocket as ChatSocket;
    const userId = socket.data.user.sub;
    void markOnline(userId);

    socket.on('disconnect', () => {
      void markOffline(userId);
    });

    // ── Room membership ────────────────────────────────────────────────
    socket.on(EventNames.RoomJoin, async (raw: unknown) => {
      const parsed = C2S_RoomJoinSchema.safeParse(raw);
      if (!parsed.success) return;
      await socket.join(`room:${parsed.data.roomId}`);
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
    socket.on(EventNames.TypingStart, (raw: unknown) => {
      const parsed = C2S_TypingStartSchema.safeParse(raw);
      if (!parsed.success) return;
      socket.to(`room:${parsed.data.roomId}`).emit(EventNames.Typing, {
        roomId: parsed.data.roomId,
        userId,
        typing: true,
      });
    });
    socket.on(EventNames.TypingStop, (raw: unknown) => {
      const parsed = C2S_TypingStopSchema.safeParse(raw);
      if (!parsed.success) return;
      socket.to(`room:${parsed.data.roomId}`).emit(EventNames.Typing, {
        roomId: parsed.data.roomId,
        userId,
        typing: false,
      });
    });

    // ── Read receipts ──────────────────────────────────────────────────
    socket.on(EventNames.ReadReceipt, async (raw: unknown) => {
      const parsed = C2S_ReadReceiptSchema.safeParse(raw);
      if (!parsed.success) return;
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
  await redis.set(`presence:${userId}`, '1', 'EX', PRESENCE_TTL_SEC);
}
async function markOffline(userId: string) {
  await redis.del(`presence:${userId}`);
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
}): Message {
  return {
    id: m.id,
    clientId: m.clientId,
    roomId: m.roomId,
    authorId: m.authorId,
    kind: m.kind,
    body: m.body,
    mediaUrl: m.mediaUrl,
    replyToId: m.replyToId,
    status: 'delivered',
    createdAt: m.createdAt.getTime(),
    editedAt: m.editedAt?.getTime() ?? null,
  };
}
