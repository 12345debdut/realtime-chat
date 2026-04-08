import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type { AuthTokens } from '@rtc/contracts';

import { env } from './env';
import { prisma } from './prisma';

const ACCESS_ALG = 'HS256';

export interface AccessPayload {
  sub: string;
  handle: string;
}

export function signAccess(payload: AccessPayload): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + env.ACCESS_TTL_SEC * 1000;
  const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: ACCESS_ALG,
    expiresIn: env.ACCESS_TTL_SEC,
  });
  return { token, expiresAt };
}

export function verifyAccess(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ACCESS_ALG] }) as AccessPayload;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Create + persist a refresh token (hash-at-rest). */
export async function issueRefresh(userId: string): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_SEC * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt },
  });
  return raw;
}

/** Rotate: invalidate the presented refresh token and issue a fresh pair. */
export async function rotateRefresh(
  presentedRaw: string,
): Promise<{ userId: string; handle: string; tokens: AuthTokens } | null> {
  const hash = sha256(presentedRaw);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;

  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });

  const { token: access, expiresAt } = signAccess({ sub: row.user.id, handle: row.user.handle });
  const refresh = await issueRefresh(row.user.id);
  return {
    userId: row.user.id,
    handle: row.user.handle,
    tokens: { accessToken: access, refreshToken: refresh, expiresAt },
  };
}
