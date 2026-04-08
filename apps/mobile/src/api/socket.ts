/**
 * Socket.IO client with exponential backoff + auth-on-connect.
 * A thin, testable wrapper — the SyncEngine layers its protocol on top.
 */
import { io, type Socket } from 'socket.io-client';

import { EventNames } from '@rtc/contracts';

import { logger } from '../lib/logger';

import { SOCKET_URL } from './config';
import { secureStore } from './secureStore';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const tokens = await secureStore.load();

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
    auth: tokens ? { token: tokens.accessToken } : undefined,
  });

  socket.on('connect', () => logger.info('socket', 'connected', socket?.id));
  socket.on('disconnect', (reason) => logger.info('socket', 'disconnected', reason));
  socket.on('connect_error', (err) => logger.warn('socket', 'connect_error', err.message));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export { EventNames };
