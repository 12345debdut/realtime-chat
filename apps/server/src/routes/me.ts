import type { FastifyInstance } from 'fastify';

import { authenticate } from '../middleware/authenticate';
import { prisma } from '../lib/prisma';

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
      createdAt: user.createdAt.getTime(),
    });
  });
}
