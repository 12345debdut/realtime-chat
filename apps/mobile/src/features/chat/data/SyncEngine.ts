/**
 * SyncEngine — orchestrates Socket.IO ↔ WatermelonDB bridging.
 *
 * Delegates room sync to RoomRepository, owns message send/ack/fail lifecycle.
 */
import { AppState, type AppStateStatus } from 'react-native';

import { Q } from '@nozbe/watermelondb';
import type { Socket } from 'socket.io-client';

import {
  EventNames,
  S2C_ConnectionAcceptedSchema,
  S2C_ConnectionRequestExpiredSchema,
  S2C_ConnectionRequestRevokedSchema,
  S2C_MessageAckSchema,
  S2C_MessageDeletedSchema,
  S2C_MessageFailSchema,
  S2C_MessageNewSchema,
  S2C_PresenceSchema,
  S2C_ReadReceiptSchema,
  S2C_TypingSchema,
  type MessageStatus,
  type SendMessageInput,
} from '@rtc/contracts';

import { collections, database } from '../../../foundation/storage';
import type { MessageModel } from '../../../foundation/storage/models/MessageModel';
import type { RoomModel } from '../../../foundation/storage/models/RoomModel';
import { kv, KvKeys } from '../../../foundation/storage/kv';
import { logger } from '../../../lib/logger';

import { roomRepository } from './RoomRepository';

const TAG = 'SyncEngine';

 
declare const crypto: any;

/** Generate a proper v4 UUID using the native crypto API (Hermes 0.64+). */
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID() as string;
  }
  // Fallback: use crypto.getRandomValues for proper entropy
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort: Math.random (should not happen on modern Hermes)
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  // Set version (4) and variant (10xx) bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = '0123456789abcdef';
  const s = Array.from(bytes, (b) => h[b >> 4] + h[b & 0x0f]).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Expose current socket for RoomRepository to join rooms. */
let _socket: Socket | null = null;
export function getSocketInstance(): Socket | null {
  return _socket;
}

/** The room the user is currently viewing (null = on the list screen). */
let _activeRoomId: string | null = null;
export function getActiveRoomId(): string | null {
  return _activeRoomId;
}

/**
 * Lightweight event bus so the presentation layer (hooks) can subscribe
 * to domain events emitted by the SyncEngine without tight coupling.
 */
type SyncEventHandler = (payload: unknown) => void;
const eventBus = new Map<string, Set<SyncEventHandler>>();

export function onSyncEvent(event: string, handler: SyncEventHandler): () => void {
  if (!eventBus.has(event)) eventBus.set(event, new Set());
  eventBus.get(event)!.add(handler);
  return () => {
    eventBus.get(event)?.delete(handler);
  };
}

function emitSyncEvent(event: string, payload: unknown) {
  eventBus.get(event)?.forEach((fn) => fn(payload));
}

/**
 * In-memory presence cache: userId → { online, lastSeenAt }.
 * Updated by every presence event from the server. Read synchronously
 * by usePresence on mount so the UI never flashes "Offline" → "Active".
 */
interface CachedPresence {
  online: boolean;
  lastSeenAt: number | null;
}
const presenceCache = new Map<string, CachedPresence>();

/** Read the last known presence for a user. Returns null if unknown. */
export function getCachedPresence(userId: string): CachedPresence | null {
  return presenceCache.get(userId) ?? null;
}

/** Client heartbeat interval — must be < server PRESENCE_TTL_SEC (90s). */
const HEARTBEAT_INTERVAL_MS = 30_000;

export class SyncEngine {
  private socket: Socket | null = null;
  private draining = false;
  private currentUserId: string | null = null;
  private activeRoomId: string | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Set the room the user is currently viewing.
   *
   * - `roomId` (entering a chat room): leave all other rooms on the server,
   *   keep only this one joined. Saves server resources — only one room is
   *   active at a time.
   * - `null` (back to chat list): rejoin ALL rooms so the list screen gets
   *   realtime `message:new` events for every conversation.
   */
  setActiveRoom(roomId: string | null) {
    const prev = this.activeRoomId;
    this.activeRoomId = roomId;
    _activeRoomId = roomId;

    if (roomId && roomId !== prev) {
      // Entering a chat room — leave all others, join only this one
      void this.focusRoom(roomId);
    } else if (!roomId && prev) {
      // Returning to chat list — rejoin all rooms
      void this.joinAllRooms();
    }
  }

  /**
   * Request fresh presence for a room by re-emitting room:join.
   * The server treats this idempotently and responds with current
   * presence for all members. Used by usePresence after its event
   * bus subscription is live — avoids the race where the initial
   * presence response arrives before the hook is listening.
   */
  requestPresence(roomId: string) {
    if (!this.socket?.connected) return;
    this.socket.emit(EventNames.RoomJoin, { roomId });
  }

  /** Leave all socket rooms, then join only the given one. */
  private async focusRoom(roomId: string) {
    if (!this.socket?.connected) return;
    try {
      const allRooms = await collections.rooms.query().fetch();
      for (const room of allRooms) {
        if (room.serverId !== roomId) {
          this.socket.emit(EventNames.RoomLeave, { roomId: room.serverId });
        }
      }
      // Ensure the target room is joined (idempotent on the server)
      this.socket.emit(EventNames.RoomJoin, { roomId });
    } catch (err) {
      logger.error(TAG, 'focusRoom failed', err);
    }
  }

  /** Rejoin all rooms — called when returning to the chat list. */
  private async joinAllRooms() {
    if (!this.socket?.connected) return;
    try {
      const allRooms = await collections.rooms.query().fetch();
      for (const room of allRooms) {
        this.socket.emit(EventNames.RoomJoin, { roomId: room.serverId });
      }
      logger.info(TAG, `rejoined ${allRooms.length} rooms`);
    } catch (err) {
      logger.error(TAG, 'joinAllRooms failed', err);
    }
  }

  /**
   * Pre-set the userId synchronously so enqueueSend works even before
   * the async socket connection + attach() completes.
   */
  setCurrentUserId(userId: string) {
    this.currentUserId = userId;
  }

  /**
   * Returns the resolved userId — from memory, or falls back to KV store.
   * Returns null only if truly unknown (no one has ever logged in on this device).
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit(EventNames.Heartbeat, {});
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private resolveUserId(): string | null {
    if (this.currentUserId) return this.currentUserId;
    const fromKv = kv.getString(KvKeys.CurrentUserId);
    if (fromKv) {
      this.currentUserId = fromKv;
    }
    return this.currentUserId;
  }

  attach(socket: Socket, currentUserId: string) {
    this.socket = socket;
    _socket = socket;
    this.currentUserId = currentUserId;

    socket.on('connect', this.onConnect);
    socket.on('disconnect', this.onDisconnect);
    socket.on('connect_error', this.onConnectError);
    socket.on(EventNames.MessageNew, this.onMessageNew);
    socket.on(EventNames.MessageAck, this.onMessageAck);
    socket.on(EventNames.MessageFail, this.onMessageFail);
    socket.on(EventNames.ConnectionAccepted, this.onConnectionAccepted);
    socket.on(EventNames.ConnectionRequestRevoked, this.onConnectionRequestRevoked);
    socket.on(EventNames.ConnectionRequestNew, this.onConnectionRequestNew);
    socket.on(EventNames.ConnectionRequestExpired, this.onConnectionRequestExpired);
    socket.on(EventNames.ReadReceiptBroadcast, this.onReadReceiptBroadcast);
    socket.on(EventNames.MessageDeleted, this.onMessageDeleted);
    socket.on(EventNames.Typing, this.onTyping);
    socket.on(EventNames.Presence, this.onPresence);

    // Listen for app foregrounding to drain outbox + re-sync rooms.
    // iOS suspends the JS thread when backgrounded; Socket.IO may reconnect
    // but the drain/sync won't happen without this nudge.
    this.appStateSubscription?.remove();
    this.appStateSubscription = AppState.addEventListener('change', this.onAppStateChange);

    // If the socket is already connected (race: autoConnect finished before
    // attach was called), fire onConnect immediately so rooms are joined
    // and the outbox is drained. The 'connect' listener above still
    // covers future reconnections.
    if (socket.connected) {
      logger.info(TAG, 'socket already connected at attach() — triggering sync');
      this.onConnect();
    }
  }

  detach() {
    if (!this.socket) return;
    this.stopHeartbeat();
    this.socket.off('connect', this.onConnect);
    this.socket.off('disconnect', this.onDisconnect);
    this.socket.off('connect_error', this.onConnectError);
    this.socket.off(EventNames.MessageNew, this.onMessageNew);
    this.socket.off(EventNames.MessageAck, this.onMessageAck);
    this.socket.off(EventNames.MessageFail, this.onMessageFail);
    this.socket.off(EventNames.ConnectionAccepted, this.onConnectionAccepted);
    this.socket.off(EventNames.ConnectionRequestRevoked, this.onConnectionRequestRevoked);
    this.socket.off(EventNames.ConnectionRequestNew, this.onConnectionRequestNew);
    this.socket.off(EventNames.ConnectionRequestExpired, this.onConnectionRequestExpired);
    this.socket.off(EventNames.ReadReceiptBroadcast, this.onReadReceiptBroadcast);
    this.socket.off(EventNames.MessageDeleted, this.onMessageDeleted);
    this.socket.off(EventNames.Typing, this.onTyping);
    this.socket.off(EventNames.Presence, this.onPresence);
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.socket = null;
    _socket = null;
    this.currentUserId = null;
  }

  /** Sync rooms from server — delegates to RoomRepository. */
  async syncRooms(): Promise<void> {
    await roomRepository.syncFromServer();
  }

  /** Optimistically create a local pending row, then drain. */
  async enqueueSend(input: Omit<SendMessageInput, 'clientId'>): Promise<string> {
    const userId = this.resolveUserId();
    if (!userId) throw new Error('SyncEngine.enqueueSend: no userId — user must log in first');
    const clientId = makeId();
    const now = Date.now();

    await database.write(async () => {
      await collections.messages.create((m) => {
        m._raw.id = clientId;
        (m as MessageModel).serverId = null;
        (m as MessageModel).clientId = clientId;
        (m as MessageModel).roomId = input.roomId;
        (m as MessageModel).authorId = userId;
        (m as MessageModel).kind = input.kind ?? 'text';
        (m as MessageModel).body = input.body;
        (m as MessageModel).mediaUrl = input.mediaUrl ?? null;
        (m as MessageModel).replyToId = input.replyToId ?? null;
        (m as MessageModel).status = 'pending' satisfies MessageStatus;
        (m as MessageModel).createdAt = new Date(now);
        (m as MessageModel).editedAt = null;
      });
    });

    void this.drain();
    return clientId;
  }

  /** Walk pending messages in insertion order and re-emit them. */
  async drain() {
    if (this.draining) return;
    if (!this.socket?.connected) return;
    this.draining = true;
    try {
      const pending = await collections.messages
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc))
        .fetch();

      for (const msg of pending) {
        const payload: SendMessageInput = {
          clientId: msg.clientId,
          roomId: msg.roomId,
          kind: msg.kind,
          body: msg.body,
          ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl } : {}),
          ...(msg.replyToId ? { replyToId: msg.replyToId } : {}),
        };
        this.socket.emit(EventNames.MessageSend, payload);
        logger.debug(TAG, 'emitted pending', msg.clientId);
      }
    } catch (err) {
      logger.error(TAG, 'drain failed', err);
    } finally {
      this.draining = false;
    }
  }

  // ── Socket event handlers ─────────────────────────────────────────────

  private onConnect = () => {
    logger.info(TAG, 'socket connected — syncing rooms + draining outbox');
    emitSyncEvent('connection', { connected: true });
    this.startHeartbeat();
    // Sync rooms first (joins socket rooms), then drain pending messages.
    // This ensures the server knows which rooms we're in before we send.
    this.syncRooms()
      .then(() => this.drain())
      .catch((err) => logger.error(TAG, 'onConnect sync+drain failed', err));
  };

  private onDisconnect = () => {
    logger.info(TAG, 'socket disconnected');
    this.stopHeartbeat();
    emitSyncEvent('connection', { connected: false });
  };

  private onConnectError = () => {
    // Fires when the socket fails to connect (bad token, no network, etc.)
    // but does NOT fire 'disconnect'. Mark offline so the banner shows.
    emitSyncEvent('connection', { connected: false });
  };

  /** When the app comes back to foreground, re-sync and drain the outbox. */
  private onAppStateChange = (state: AppStateStatus) => {
    if (state !== 'active') return;
    logger.info(TAG, 'app foregrounded — syncing rooms + draining outbox');

    // Send an immediate heartbeat — the JS thread may have been suspended
    // for minutes while backgrounded, so the Redis TTL could be close to
    // expiring. This refreshes it before any room:join presence checks.
    if (this.socket?.connected) {
      this.socket.emit(EventNames.Heartbeat, {});
    }
    this.startHeartbeat();

    // The socket may have reconnected while backgrounded, but the JS thread
    // was suspended so onConnect may not have fired. Kick everything off.
    // syncRooms → joinAllRooms/focusRoom → room:join on server → presence
    // is exchanged automatically during room join.
    this.syncRooms()
      .then(() => this.drain())
      .catch((err) => logger.error(TAG, 'foreground sync+drain failed', err));
  };

  private onMessageAck = async (raw: unknown) => {
    try {
      const parsed = S2C_MessageAckSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn(TAG, 'bad ack', parsed.error.issues);
        return;
      }
      const { clientId, serverId, createdAt } = parsed.data;
      await database.write(async () => {
        const rows = await collections.messages.query(Q.where('client_id', clientId)).fetch();
        if (!rows.length) return;
        for (const row of rows) {
          await row.update((m) => {
            (m as MessageModel).serverId = serverId;
            (m as MessageModel).status = 'sent';
            (m as MessageModel).createdAt = new Date(createdAt);
          });
        }
      });
      kv.setNumber(KvKeys.LastSyncedAt, Math.max(kv.getNumber(KvKeys.LastSyncedAt) ?? 0, createdAt));
    } catch (err) {
      logger.error(TAG, 'onMessageAck failed', err);
    }
  };

  private onMessageFail = async (raw: unknown) => {
    try {
      const parsed = S2C_MessageFailSchema.safeParse(raw);
      if (!parsed.success) return;
      await database.write(async () => {
        const rows = await collections.messages.query(Q.where('client_id', parsed.data.clientId)).fetch();
        for (const row of rows) {
          await row.update((m) => {
            (m as MessageModel).status = 'failed';
          });
        }
      });
    } catch (err) {
      logger.error(TAG, 'onMessageFail failed', err);
    }
  };

  private onMessageNew = async (raw: unknown) => {
    try {
      const parsed = S2C_MessageNewSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn(TAG, 'bad message:new', parsed.error.issues);
        return;
      }
      const m = parsed.data.message;

      await database.write(async () => {
        // Update room's last message preview + unread count
        const roomRows = await collections.rooms.query(Q.where('server_id', m.roomId)).fetch();
        if (roomRows.length) {
          const shouldIncrement =
            m.authorId !== this.currentUserId &&
            m.roomId !== this.activeRoomId &&
            m.kind !== 'system';
          await roomRows[0].update((r) => {
            (r as RoomModel).lastMessagePreview = m.body.slice(0, 280);
            (r as RoomModel).lastMessageAt = m.createdAt;
            (r as RoomModel).updatedAt = new Date(m.createdAt);
            if (shouldIncrement) {
              (r as RoomModel).unreadCount = (roomRows[0].unreadCount ?? 0) + 1;
            }
          });
        }

        // Upsert message
        const existing = await collections.messages.query(Q.where('client_id', m.clientId)).fetch();
        if (existing.length) {
          for (const row of existing) {
            await row.update((r) => {
              (r as MessageModel).serverId = m.id;
              (r as MessageModel).status = m.status;
            });
          }
        } else {
          await collections.messages.create((r) => {
            r._raw.id = m.clientId;
            (r as MessageModel).serverId = m.id;
            (r as MessageModel).clientId = m.clientId;
            (r as MessageModel).roomId = m.roomId;
            (r as MessageModel).authorId = m.authorId;
            (r as MessageModel).kind = m.kind;
            (r as MessageModel).body = m.body;
            (r as MessageModel).mediaUrl = m.mediaUrl;
            (r as MessageModel).replyToId = m.replyToId;
            (r as MessageModel).status = m.status;
            (r as MessageModel).createdAt = new Date(m.createdAt);
            (r as MessageModel).editedAt = m.editedAt ? new Date(m.editedAt) : null;
            (r as MessageModel).deletedAt = m.deletedAt ? new Date(m.deletedAt) : null;
          });
        }
      });
      kv.setNumber(KvKeys.LastSyncedAt, Math.max(kv.getNumber(KvKeys.LastSyncedAt) ?? 0, m.createdAt));
    } catch (err) {
      logger.error(TAG, 'onMessageNew failed', err);
    }
  };

  private onConnectionAccepted = async (raw: unknown) => {
    const parsed = S2C_ConnectionAcceptedSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(TAG, 'bad connection:accepted', parsed.error.issues);
      return;
    }
    const room = parsed.data.room;
    await roomRepository.upsertRoom(room);

    if (this.socket?.connected) {
      this.socket.emit(EventNames.RoomJoin, { roomId: room.id });
    }
    logger.info(TAG, 'connection accepted, room created', room.id);
  };

  private onConnectionRequestRevoked = (raw: unknown) => {
    const parsed = S2C_ConnectionRequestRevokedSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(TAG, 'bad connection:request:revoked', parsed.error.issues);
      return;
    }
    // Notify the presentation layer so it can remove the request from the received list
    emitSyncEvent('connection:request:revoked', parsed.data);
    logger.info(TAG, 'connection request revoked', parsed.data.requestId);
  };

  private onConnectionRequestExpired = (raw: unknown) => {
    const parsed = S2C_ConnectionRequestExpiredSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(TAG, 'bad connection:request:expired', parsed.error.issues);
      return;
    }
    // Notify the presentation layer so it can remove the request from the sent list
    emitSyncEvent('connection:request:expired', parsed.data);
    logger.info(TAG, 'connection request expired', parsed.data.requestId);
  };

  private onConnectionRequestNew = (raw: unknown) => {
    // Forward to the presentation layer so it can add the request to the received list
    emitSyncEvent('connection:request:new', raw);
    logger.info(TAG, 'new connection request received');
  };

  private onReadReceiptBroadcast = async (raw: unknown) => {
    try {
      const parsed = S2C_ReadReceiptSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn(TAG, 'bad read:receipt:broadcast', parsed.error.issues);
        return;
      }
      const { roomId, userId, upToMessageId } = parsed.data;
      if (!this.currentUserId) return;

      // Multi-device: if the current user read on another device, reset unread badge
      if (userId === this.currentUserId) {
        await database.write(async () => {
          const roomRows = await collections.rooms
            .query(Q.where('server_id', roomId))
            .fetch();
          if (roomRows.length && roomRows[0].unreadCount > 0) {
            await roomRows[0].update((r) => {
              (r as RoomModel).unreadCount = 0;
            });
          }
        });
        return;
      }

      // The other person read our messages — update statuses to 'read'
      await database.write(async () => {
        // Find the target message to get its timestamp
        const targetRows = await collections.messages
          .query(Q.where('server_id', upToMessageId))
          .fetch();
        if (!targetRows.length) return;
        const upToTs = targetRows[0].createdAt.getTime();

        // Mark all own sent/delivered messages in this room up to that time as 'read'
        const messagesToUpdate = await collections.messages
          .query(
            Q.where('room_id', roomId),
            Q.where('author_id', this.currentUserId!),
            Q.where('status', Q.oneOf(['sent', 'delivered'])),
            Q.where('created_at', Q.lte(upToTs)),
          )
          .fetch();

        for (const msg of messagesToUpdate) {
          await msg.update((m) => {
            (m as MessageModel).status = 'read';
          });
        }
      });
      logger.debug(TAG, `read receipt: ${userId} read up to ${upToMessageId}`);
    } catch (err) {
      logger.error(TAG, 'onReadReceiptBroadcast failed', err);
    }
  };

  /** Message deleted — soft-delete: clear body, set deletedAt. */
  private onMessageDeleted = async (raw: unknown) => {
    try {
      const parsed = S2C_MessageDeletedSchema.safeParse(raw);
      if (!parsed.success) {
        logger.warn(TAG, 'bad message:deleted', parsed.error.issues);
        return;
      }
      const { messageId, deletedAt } = parsed.data;
      await database.write(async () => {
        const rows = await collections.messages
          .query(Q.where('server_id', messageId))
          .fetch();
        for (const row of rows) {
          await row.update((m) => {
            (m as MessageModel).body = '';
            (m as MessageModel).deletedAt = new Date(deletedAt);
          });
        }
      });
      logger.info(TAG, `message deleted: ${messageId}`);
    } catch (err) {
      logger.error(TAG, 'onMessageDeleted failed', err);
    }
  };

  /** Typing event — ephemeral, no DB write, just forward to presentation layer. */
  private onTyping = (raw: unknown) => {
    const parsed = S2C_TypingSchema.safeParse(raw);
    if (!parsed.success) return;
    emitSyncEvent('typing', parsed.data);
  };

  /** Presence event — cache + forward to presentation layer for online/offline UI. */
  private onPresence = (raw: unknown) => {
    const parsed = S2C_PresenceSchema.safeParse(raw);
    if (!parsed.success) return;
    // Update cache BEFORE emitting so any synchronous reader sees fresh data.
    presenceCache.set(parsed.data.userId, {
      online: parsed.data.online,
      lastSeenAt: parsed.data.lastSeenAt ?? null,
    });
    emitSyncEvent('presence', parsed.data);
  };

  /** Send a read receipt to the server for the given room + message. */
  sendReadReceipt(roomId: string, upToMessageId: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit(EventNames.ReadReceipt, { roomId, upToMessageId });
    logger.debug(TAG, `sent read receipt for room ${roomId} up to ${upToMessageId}`);
  }
}

export const syncEngine = new SyncEngine();
