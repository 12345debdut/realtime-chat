import type { FastifyInstance } from 'fastify';

import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/authenticate';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  /** List all users (excluding the current user). Supports ?search= for filtering.
   *  Filters out users with pending or accepted connections per product spec Section 8.
   *  Users with ignored connections ARE shown (allow re-discovery). */
  app.get<{ Querystring: { search?: string } }>('/users', async (req, reply) => {
    const userId = req.user!.sub;
    const search = req.query.search?.trim();

    // F-2, F-3, F-4: Collect user IDs with pending or accepted connection requests
    const connectionExclusions = await prisma.connectionRequest.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: { in: ['pending', 'accepted'] },
      },
      select: { senderId: true, receiverId: true },
    });

    const excludedIds = new Set<string>();
    for (const c of connectionExclusions) {
      excludedIds.add(c.senderId === userId ? c.receiverId : c.senderId);
    }

    // F-5: Safety net -- also exclude users who share a DM room with me
    const dmMemberships = await prisma.membership.findMany({
      where: {
        userId: { not: userId },
        room: {
          kind: 'dm',
          memberships: { some: { userId } },
        },
      },
      select: { userId: true },
    });
    for (const m of dmMemberships) {
      excludedIds.add(m.userId);
    }

    // F-1: Exclude self (handled below in query)
    const allExcluded = [userId, ...excludedIds];

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: allExcluded },
        ...(search
          ? {
              OR: [
                { handle: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, handle: true, displayName: true, avatarUrl: true, createdAt: true },
      orderBy: { displayName: 'asc' },
      take: 50,
    });

    return reply.send(
      users.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.getTime(),
      })),
    );
  });
}
