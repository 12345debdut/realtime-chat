import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyAccess, type AccessPayload } from '../lib/tokens';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessPayload;
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'missing_token' });
    return;
  }
  try {
    req.user = verifyAccess(header.slice(7));
  } catch {
    await reply.code(401).send({ error: 'invalid_token' });
  }
}
