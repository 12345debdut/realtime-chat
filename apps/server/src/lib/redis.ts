import { Redis } from 'ioredis';

import { env } from './env';

/** Primary connection — commands. */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

/** Pub/sub connections required by @socket.io/redis-adapter. */
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();
