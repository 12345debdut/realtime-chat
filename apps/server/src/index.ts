/**
 * Server entry — wires Fastify for REST + Socket.IO for realtime,
 * sharing the same HTTP server instance so both live behind one port.
 */
import cors from '@fastify/cors';
// eslint-disable-next-line import/default
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify from 'fastify';

import { env } from './lib/env';
import { prisma } from './lib/prisma';
import { authRoutes } from './routes/auth';
import { connectionRoutes } from './routes/connections';
import { meRoutes } from './routes/me';
import { roomRoutes } from './routes/rooms';
import { tagRoutes } from './routes/tags';
import { userRoutes } from './routes/users';
import { attachChatSockets } from './sockets/chat';

async function main() {
  const isDev = env.NODE_ENV === 'development';
  const loggerConfig = isDev
    ? {
        level: 'debug',
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }
    : { level: 'info' };
  const app = Fastify({ logger: loggerConfig, trustProxy: true });

  // ── Security middleware ────────────────────────────────────────────────
  //
  // CORS:
  //   - dev: reflect any origin (convenient for Metro/localhost)
  //   - prod: restrict to WEB_ORIGIN allowlist. Mobile clients don't send
  //           Origin, so they're unaffected. `true` in prod would let any
  //           malicious site make credentialed fetches with a stolen token.
  const webOrigins = env.WEB_ORIGIN
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: isDev ? true : (webOrigins.length > 0 ? webOrigins : false),
    credentials: true,
  });

  // Helmet — HSTS, X-Content-Type-Options, Referrer-Policy, etc.
  // CSP disabled because we serve JSON only; no HTML to protect.
  await app.register(helmet, { contentSecurityPolicy: false });

  // Global rate limit — 300 req/min/IP as a DoS backstop. Individual routes
  // (auth) tighten this further via their own `config.rateLimit`.
  // In dev, `allowList` bypasses enforcement so hot reload / test scripts
  // don't trip the limiter; the plugin still registers so per-route configs
  // remain wired.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    allowList: () => isDev,
  });

  await app.register(sensible);

  // ── Global error handler ───────────────────────────────────────────────
  //
  // Route handlers should throw `app.httpErrors.*` (from @fastify/sensible)
  // or return `reply.code(4xx).send({ error: '...' })` explicitly. Anything
  // that escapes without a handled shape lands here.
  //
  // What this does:
  //   - Logs the error server-side with Pino (full stack in dev, scrubbed in prod)
  //   - Preserves the client-facing 4xx envelope for errors that already have one
  //   - Normalises everything else to `{ error: 'internal_error' }` with a 500
  //     so we never leak a stack trace, SQL fragment, or internal path name
  //     through the HTTP response.
  //
  // Rate-limit hits (`FST_ERR_RATE_LIMIT_EXCEEDED`) are intentionally passed
  // through to the plugin's default 429 response, not wrapped here.
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err }, 'unhandled_error');
      return reply.code(500).send({ error: 'internal_error' });
    }
    // 4xx — the handler already chose a code; keep the client contract.
    req.log.warn({ err, status }, 'client_error');
    return reply.code(status).send({
      error: err.code ?? 'bad_request',
      message: err.message,
    });
  });

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(roomRoutes);
  await app.register(tagRoutes);
  await app.register(userRoutes);
  await app.register(connectionRoutes);

  app.get('/health', async () => ({ status: 'ok' }));

  // Warm up Neon serverless DB connection so first user request isn't slow
  await prisma.$queryRaw`SELECT 1`.catch(() => {});

  // Keep Neon connection warm — ping every 4 minutes to prevent cold starts
  setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => {});
  }, 4 * 60 * 1000);

  await app.listen({ host: '0.0.0.0', port: env.PORT });

  // Attach Socket.IO to the same underlying HTTP server Fastify created.
  attachChatSockets(app.server);
  app.log.info('socket.io attached');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
