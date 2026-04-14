/**
 * Socket.IO client with exponential backoff + auth-on-connect.
 * A thin, testable wrapper — the SyncEngine layers its protocol on top.
 */
import { io, type Socket } from 'socket.io-client';

import { EventNames } from '@rtc/contracts';

import { logger } from '../../lib/logger';

import { SOCKET_URL } from './config';
import { secureStore } from './secureStore';

let socket: Socket | null = null;

/**
 * Create the Socket.IO client and wait for the actual connection to
 * complete before returning. This eliminates the race where callers
 * receive a socket that is still connecting and miss the initial
 * 'connect' event.
 */
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  // If a socket already exists but isn't connected (e.g. reconnecting),
  // tear it down and start fresh so listeners aren't duplicated.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const s = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: false, // We manually call connect() below so we can await it
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    // Use callback form so each reconnect attempt fetches the latest token
    // from secure store, instead of baking a stale token at connect time.
    auth: (cb) => {
      secureStore
        .load()
        .then((tokens) => cb({ token: tokens?.accessToken ?? '' }))
        .catch(() => cb({ token: '' }));
    },
  });

  s.on('connect', () => logger.info('socket', 'connected', s.id));
  s.on('disconnect', (reason) => logger.info('socket', 'disconnected', reason));
  s.on('connect_error', (err) => logger.warn('socket', 'connect_error', err.message));

  socket = s;

  // Wait for the first successful connection before returning.
  // If the initial connect fails, Socket.IO's built-in reconnection will
  // keep retrying — we resolve on the first success.
  return new Promise<Socket>((resolve) => {
    s.once('connect', () => resolve(s));
    s.connect();
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export { EventNames };
