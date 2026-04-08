/**
 * Server entry — wires Fastify for REST + Socket.IO for realtime,
 * sharing the same HTTP server instance so both live behind one port.
 */
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import { env } from './lib/env';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { roomRoutes } from './routes/rooms';
import { attachChatSockets } from './sockets/chat';

async function main() {
  const isDev = env.NODE_ENV === 'development';
  const loggerConfig = isDev
    ? {
        level: 'debug',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : { level: 'info' };
  const app = Fastify({ logger: loggerConfig });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(roomRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ host: '0.0.0.0', port: env.PORT });

  // Attach Socket.IO to the same underlying HTTP server Fastify created.
  attachChatSockets(app.server);
  app.log.info('socket.io attached');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
