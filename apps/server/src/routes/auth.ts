import { LoginRequestSchema, RegisterRequestSchema, type AuthResponse } from '@rtc/contracts';
// eslint-disable-next-line import/default
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';


import { prisma } from '../lib/prisma';
import { issueRefresh, rotateRefresh, signAccess } from '../lib/tokens';

/**
 * Auth routes are the most attacked surface on the server — credential
 * stuffing, handle enumeration, refresh-token probing. Each handler below
 * declares a tight per-IP rate limit via `config.rateLimit`. These override
 * the global limit set in `index.ts`.
 *
 * Numbers chosen to be strict enough to make automated attacks painful but
 * loose enough that a real user mistyping a password doesn't get locked out.
 */
const authLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
    },
  },
};

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', authLimit, async (req, reply) => {
    const body = RegisterRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues });

    const existing = await prisma.user.findUnique({ where: { handle: body.data.handle } });
    if (existing) return reply.code(409).send({ error: 'handle_taken' });

    const passwordHash = await argon2.hash(body.data.password);
    const user = await prisma.user.create({
      data: {
        handle: body.data.handle,
        displayName: body.data.displayName,
        passwordHash,
      },
    });

    const access = signAccess({ sub: user.id, handle: user.handle });
    const refreshToken = await issueRefresh(user.id);

    const response: AuthResponse = {
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        email: user.email,
        phone: user.phone,
        dateOfBirth: (user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null) as string | null,
        location: user.location,
        privacy: {
          readReceiptsEnabled: user.readReceiptsEnabled,
          onlineStatusVisible: user.onlineStatusVisible,
          typingIndicatorsEnabled: user.typingIndicatorsEnabled,
        },
        createdAt: user.createdAt.getTime(),
      },
      tokens: {
        accessToken: access.token,
        refreshToken,
        expiresAt: access.expiresAt,
      },
    };
    return reply.code(201).send(response);
  });

  app.post('/auth/login', authLimit, async (req, reply) => {
    const body = LoginRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    const user = await prisma.user.findUnique({ where: { handle: body.data.handle } });
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await argon2.verify(user.passwordHash, body.data.password);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    const access = signAccess({ sub: user.id, handle: user.handle });
    const refreshToken = await issueRefresh(user.id);

    const response: AuthResponse = {
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        email: user.email,
        phone: user.phone,
        dateOfBirth: (user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : null) as string | null,
        location: user.location,
        privacy: {
          readReceiptsEnabled: user.readReceiptsEnabled,
          onlineStatusVisible: user.onlineStatusVisible,
          typingIndicatorsEnabled: user.typingIndicatorsEnabled,
        },
        createdAt: user.createdAt.getTime(),
      },
      tokens: { accessToken: access.token, refreshToken, expiresAt: access.expiresAt },
    };
    return reply.send(response);
  });

  app.post<{ Body: { refreshToken: string } }>('/auth/refresh', authLimit, async (req, reply) => {
    const raw = req.body?.refreshToken;
    if (!raw) return reply.code(400).send({ error: 'missing_refresh' });
    const rotated = await rotateRefresh(raw);
    if (!rotated) return reply.code(401).send({ error: 'invalid_refresh' });
    return reply.send(rotated.tokens);
  });
}
