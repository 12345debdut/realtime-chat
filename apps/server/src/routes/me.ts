import type { FastifyInstance } from 'fastify';

import { PrivacySettingsUpdateSchema } from '@rtc/contracts';

import { authenticate } from '../middleware/authenticate';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export async function meRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ error: 'not_found' });

    return reply.send({
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      privacy: {
        readReceiptsEnabled: user.readReceiptsEnabled,
        onlineStatusVisible: user.onlineStatusVisible,
        typingIndicatorsEnabled: user.typingIndicatorsEnabled,
      },
      createdAt: user.createdAt.getTime(),
    });
  });

  app.patch('/me/privacy', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = PrivacySettingsUpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues });

    // Build data object with only defined fields to satisfy exactOptionalPropertyTypes
    const data: Record<string, boolean> = {};
    if (body.data.readReceiptsEnabled !== undefined) data.readReceiptsEnabled = body.data.readReceiptsEnabled;
    if (body.data.onlineStatusVisible !== undefined) data.onlineStatusVisible = body.data.onlineStatusVisible;
    if (body.data.typingIndicatorsEnabled !== undefined) data.typingIndicatorsEnabled = body.data.typingIndicatorsEnabled;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Invalidate Redis privacy cache
    await redis.del(`privacy:${userId}`);

    return reply.send({
      readReceiptsEnabled: user.readReceiptsEnabled,
      onlineStatusVisible: user.onlineStatusVisible,
      typingIndicatorsEnabled: user.typingIndicatorsEnabled,
    });
  });
}
