import { AddTagToRoomRequestSchema, CreateRoomRequestSchema } from '@rtc/contracts';
import type { FastifyInstance } from 'fastify';


import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

export async function roomRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/rooms', async (req, reply) => {
    const userId = req.user!.sub;
    const rooms = await prisma.room.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        memberships: {
          include: { user: { select: { id: true, handle: true, displayName: true, avatarUrl: true } } },
        },
        pins: { where: { userId } },
        roomTags: {
          include: { tag: true },
          where: { tag: { userId } },
        },
      },
    });

    // Compute unread counts for all rooms in a single SQL pass.
    // For each room, count messages created after the user's lastReadMessage
    // (excluding messages authored by the user themselves).
    const unreadCounts = await prisma.$queryRaw<
      { roomId: string; count: bigint }[]
    >`
      SELECT msg."roomId" AS "roomId", COUNT(*)::bigint AS count
      FROM "Message" msg
      JOIN "Membership" m ON m."roomId" = msg."roomId" AND m."userId" = ${userId}
      WHERE msg."authorId" != ${userId}
        AND (
          m."lastReadMessageId" IS NULL
          OR msg."createdAt" > (
            SELECT lr."createdAt" FROM "Message" lr WHERE lr.id = m."lastReadMessageId"
          )
        )
      GROUP BY msg."roomId"
    `;
    const unreadMap = new Map(
      unreadCounts.map((row) => [row.roomId, Number(row.count)]),
    );

    return reply.send(
      rooms.map((r) => {
        // For DMs, use the other person's name as the room title
        let title = r.title;
        if (r.kind === 'dm' && !title) {
          const peer = r.memberships.find((m) => m.userId !== userId);
          title = peer?.user?.displayName ?? 'Chat';
        }
        return {
          id: r.id,
          kind: r.kind,
          title,
          createdAt: r.createdAt.getTime(),
          updatedAt: r.updatedAt.getTime(),
          lastMessagePreview: r.lastMessagePreview,
          lastMessageAt: r.lastMessageAt?.getTime() ?? null,
          memberIds: r.memberships.map((m) => m.userId),
          isPinned: r.pins.length > 0,
          tags: r.roomTags.map((rt) => ({
            id: rt.tag.id,
            name: rt.tag.name,
            color: rt.tag.color,
            createdAt: rt.tag.createdAt.getTime(),
          })),
          unreadCount: unreadMap.get(r.id) ?? 0,
        };
      }),
    );
  });

  app.post('/rooms', async (req, reply) => {
    const body = CreateRoomRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    // DM rooms must only be created via the accept-connection flow
    if (body.data.kind === 'dm') {
      return reply.code(403).send({ error: 'dm_rooms_created_via_connections' });
    }

    const userId = req.user!.sub;
    const members = Array.from(new Set([userId, ...body.data.memberIds]));

    const room = await prisma.room.create({
      data: {
        kind: body.data.kind,
        title: body.data.title ?? null,
        memberships: { create: members.map((uid) => ({ userId: uid })) },
      },
      include: { memberships: true },
    });
    return reply.code(201).send({
      id: room.id,
      kind: room.kind,
      title: room.title,
      createdAt: room.createdAt.getTime(),
      updatedAt: room.updatedAt.getTime(),
      lastMessagePreview: null,
      lastMessageAt: null,
      memberIds: room.memberships.map((m) => m.userId),
      isPinned: false,
      tags: [],
    });
  });

  // Toggle pin
  app.put<{ Params: { id: string } }>('/rooms/:id/pin', async (req, reply) => {
    const userId = req.user!.sub;
    const roomId = req.params.id;

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership) return reply.code(403).send({ error: 'forbidden' });

    // Toggle
    const existing = await prisma.roomPin.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });

    if (existing) {
      await prisma.roomPin.delete({ where: { id: existing.id } });
      return reply.send({ pinned: false });
    } else {
      await prisma.roomPin.create({ data: { userId, roomId } });
      return reply.send({ pinned: true });
    }
  });

  // Leave/delete room (for the requesting user)
  app.delete<{ Params: { id: string } }>('/rooms/:id', async (req, reply) => {
    const userId = req.user!.sub;
    const roomId = req.params.id;

    // For DM rooms, also remove the ConnectionRequest so users can reconnect later.
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { memberships: { select: { userId: true } } },
    });

    await prisma.$transaction(async (tx) => {
      // Delete user's membership, pin, and room tags
      await tx.membership.deleteMany({ where: { userId, roomId } });
      await tx.roomPin.deleteMany({ where: { userId, roomId } });
      await tx.roomTag.deleteMany({ where: { roomId, tag: { userId } } });

      // For DM rooms, delete the connection request between the two users
      // so either party can send a fresh request in the future.
      if (room?.kind === 'dm') {
        const peerId = room.memberships.find((m) => m.userId !== userId)?.userId;
        if (peerId) {
          await tx.connectionRequest.deleteMany({
            where: {
              OR: [
                { senderId: userId, receiverId: peerId },
                { senderId: peerId, receiverId: userId },
              ],
            },
          });
        }
      }
    });

    return reply.code(204).send();
  });

  // Add tag to room
  app.post<{ Params: { id: string } }>('/rooms/:id/tags', async (req, reply) => {
    const userId = req.user!.sub;
    const roomId = req.params.id;

    const body = AddTagToRoomRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { userId_roomId: { userId, roomId } },
    });
    if (!membership) return reply.code(403).send({ error: 'forbidden' });

    // Verify tag ownership
    const tag = await prisma.tag.findUnique({ where: { id: body.data.tagId } });
    if (!tag || tag.userId !== userId) return reply.code(403).send({ error: 'forbidden' });

    // Upsert room tag
    await prisma.roomTag.upsert({
      where: { roomId_tagId: { roomId, tagId: body.data.tagId } },
      create: { roomId, tagId: body.data.tagId },
      update: {},
    });

    return reply.code(201).send({ ok: true });
  });

  // Remove tag from room
  app.delete<{ Params: { id: string; tagId: string } }>(
    '/rooms/:id/tags/:tagId',
    async (req, reply) => {
      const userId = req.user!.sub;
      const roomId = req.params.id;
      const tagId = req.params.tagId;

      // Verify tag ownership
      const tag = await prisma.tag.findUnique({ where: { id: tagId } });
      if (!tag || tag.userId !== userId) return reply.code(403).send({ error: 'forbidden' });

      await prisma.roomTag.deleteMany({ where: { roomId, tagId } });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/rooms/:id/messages',
    async (req, reply) => {
      const userId = req.user!.sub;
      const roomId = req.params.id;
      const limit = Math.min(Number(req.query.limit ?? 30), 100);

      const membership = await prisma.membership.findUnique({
        where: { userId_roomId: { userId, roomId } },
      });
      if (!membership) return reply.code(403).send({ error: 'forbidden' });

      const messages = await prisma.message.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(req.query.cursor ? { skip: 1, cursor: { id: req.query.cursor } } : {}),
      });

      // Build a set of message IDs that have been read by at least one
      // other member. We look at each member's lastReadMessageId and
      // collect the timestamps so we can mark messages as 'read'.
      const memberships = await prisma.membership.findMany({
        where: { roomId },
        select: { userId: true, lastReadMessageId: true },
      });

      // For each non-self member, find the timestamp of their lastReadMessage
      // so we can compare: if a message was created <= that timestamp, it's 'read'.
      let peerReadUpToTs: Date | null = null;
      for (const mem of memberships) {
        if (mem.userId === userId || !mem.lastReadMessageId) continue;
        const readMsg = await prisma.message.findUnique({
          where: { id: mem.lastReadMessageId },
          select: { createdAt: true },
        });
        if (readMsg) {
          if (!peerReadUpToTs || readMsg.createdAt > peerReadUpToTs) {
            peerReadUpToTs = readMsg.createdAt;
          }
        }
      }

      return reply.send(
        messages.map((m) => {
          let status: string = 'delivered';
          if (
            m.authorId === userId &&
            peerReadUpToTs &&
            m.createdAt <= peerReadUpToTs
          ) {
            status = 'read';
          }
          return {
            id: m.id,
            clientId: m.clientId,
            roomId: m.roomId,
            authorId: m.authorId,
            kind: m.kind,
            body: m.deletedAt ? '' : m.body,
            mediaUrl: m.deletedAt ? null : m.mediaUrl,
            replyToId: m.replyToId,
            status,
            createdAt: m.createdAt.getTime(),
            editedAt: m.editedAt?.getTime() ?? null,
            deletedAt: m.deletedAt?.getTime() ?? null,
          };
        }),
      );
    },
  );
}
