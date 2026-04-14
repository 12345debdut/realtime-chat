import type { FastifyInstance } from 'fastify';

import { CreateTagRequestSchema } from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

export async function tagRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List all tags for the current user
  app.get('/tags', async (req, reply) => {
    const userId = req.user!.sub;
    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return reply.send(
      tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        createdAt: t.createdAt.getTime(),
      })),
    );
  });

  // Create a new tag
  app.post('/tags', async (req, reply) => {
    const userId = req.user!.sub;
    const body = CreateTagRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    // Check for duplicate
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId, name: body.data.name } },
    });
    if (existing) return reply.code(409).send({ error: 'tag_exists' });

    const tag = await prisma.tag.create({
      data: {
        userId,
        name: body.data.name,
        color: body.data.color ?? '#4ECDC4',
      },
    });

    return reply.code(201).send({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt.getTime(),
    });
  });

  // Delete a tag (cascades to room_tags)
  app.delete<{ Params: { id: string } }>('/tags/:id', async (req, reply) => {
    const userId = req.user!.sub;
    const tagId = req.params.id;

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag || tag.userId !== userId) return reply.code(403).send({ error: 'forbidden' });

    await prisma.tag.delete({ where: { id: tagId } });
    return reply.code(204).send();
  });
}
