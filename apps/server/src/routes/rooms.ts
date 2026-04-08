import type { FastifyInstance } from 'fastify';

import { CreateRoomRequestSchema } from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

export async function roomRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/rooms', async (req, reply) => {
    const userId = req.user!.sub;
    const rooms = await prisma.room.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: { memberships: true },
    });
    return reply.send(
      rooms.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        createdAt: r.createdAt.getTime(),
        updatedAt: r.updatedAt.getTime(),
        lastMessagePreview: r.lastMessagePreview,
        lastMessageAt: r.lastMessageAt?.getTime() ?? null,
        memberIds: r.memberships.map((m) => m.userId),
      })),
    );
  });

  app.post('/rooms', async (req, reply) => {
    const body = CreateRoomRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });
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
    });
  });

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
      return reply.send(
        messages.map((m) => ({
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
        })),
      );
    },
  );
}
