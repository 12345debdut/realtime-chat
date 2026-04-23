
import { PrivacySettingsUpdateSchema, ProfileUpdateSchema } from '@rtc/contracts';
import type { FastifyInstance } from 'fastify';

import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { authenticate } from '../middleware/authenticate';

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
      bio: user.bio,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
      location: user.location,
      privacy: {
        readReceiptsEnabled: user.readReceiptsEnabled,
        onlineStatusVisible: user.onlineStatusVisible,
        typingIndicatorsEnabled: user.typingIndicatorsEnabled,
      },
      createdAt: user.createdAt.getTime(),
    });
  });

  app.patch('/me/profile', { preHandler: authenticate }, async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = ProfileUpdateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues });

    // Server-side age validation for dateOfBirth
    if (body.data.dateOfBirth) {
      const dob = new Date(body.data.dateOfBirth);
      const now = new Date();
      if (dob > now) {
        return reply.code(400).send({ error: 'invalid_body', message: 'Date of birth cannot be in the future' });
      }
      const age = now.getFullYear() - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      const dayDiff = now.getDate() - dob.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      if (actualAge < 13) {
        return reply.code(400).send({ error: 'invalid_body', message: 'You must be at least 13 years old' });
      }
    }

    // Build data object
    const data: Record<string, any> = {};
    if (body.data.displayName !== undefined) data.displayName = body.data.displayName;
    if (body.data.bio !== undefined) data.bio = body.data.bio?.trim() || null;
    if (body.data.email !== undefined) data.email = body.data.email?.trim().toLowerCase() || null;
    if (body.data.phone !== undefined) data.phone = body.data.phone || null;
    if (body.data.dateOfBirth !== undefined) data.dateOfBirth = body.data.dateOfBirth ? new Date(body.data.dateOfBirth) : null;
    if (body.data.location !== undefined) data.location = body.data.location?.trim() || null;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return reply.send({
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null,
      location: user.location,
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
