import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';

import { LoginRequestSchema, RegisterRequestSchema, type AuthResponse } from '@rtc/contracts';

import { prisma } from '../lib/prisma';
import { issueRefresh, rotateRefresh, signAccess } from '../lib/tokens';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (req, reply) => {
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

  app.post('/auth/login', async (req, reply) => {
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
        createdAt: user.createdAt.getTime(),
      },
      tokens: { accessToken: access.token, refreshToken, expiresAt: access.expiresAt },
    };
    return reply.send(response);
  });

  app.post<{ Body: { refreshToken: string } }>('/auth/refresh', async (req, reply) => {
    const raw = req.body?.refreshToken;
    if (!raw) return reply.code(400).send({ error: 'missing_refresh' });
    const rotated = await rotateRefresh(raw);
    if (!rotated) return reply.code(401).send({ error: 'invalid_refresh' });
    return reply.send(rotated.tokens);
  });
}
