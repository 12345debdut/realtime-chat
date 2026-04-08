/**
 * SyncEngine — the bridge between Socket.IO and WatermelonDB.
 *
 * Responsibilities:
 *  1. Optimistic writes: enqueueSend() inserts a pending row immediately so
 *     the UI renders without waiting for the network.
 *  2. Outbox drain: on every (re)connect, stream pending rows to the server
 *     in FIFO order. Each emit carries a clientId (idempotency key) so retries
 *     are safe even if an earlier attempt actually landed.
 *  3. Ack reconciliation: on `message:ack`, mark the local row `sent` and
 *     stamp its serverId. On `message:fail`, mark `failed` for UI retry.
 *  4. Inbound writes: `message:new` events are upserted by clientId to avoid
 *     duplicating optimistic rows when the echo comes back to the sender.
 *  5. Backfill on reconnect: the engine could fetch missed messages via REST
 *     `?since=lastSyncedAt`. Left as a TODO marker for brevity.
 *
 * The engine owns zero UI state — everything flows through WatermelonDB,
 * which the UI observes via `database.get(...).query().observe()`.
 */
import { Q } from '@nozbe/watermelondb';
import type { Socket } from 'socket.io-client';
import { v4 as uuid } from 'uuid';

import {
  EventNames,
  S2C_MessageAckSchema,
  S2C_MessageFailSchema,
  S2C_MessageNewSchema,
  type MessageStatus,
  type SendMessageInput,
} from '@rtc/contracts';

import { collections, database } from '../db';
import type { MessageModel } from '../db/models/MessageModel';
import { kv, KvKeys } from '../lib/kv';
import { logger } from '../lib/logger';

const TAG = 'SyncEngine';

export class SyncEngine {
  private socket: Socket | null = null;
  private draining = false;
  private currentUserId: string | null = null;

  attach(socket: Socket, currentUserId: string) {
    this.socket = socket;
    this.currentUserId = currentUserId;

    socket.on('connect', this.onConnect);
    socket.on(EventNames.MessageNew, this.onMessageNew);
    socket.on(EventNames.MessageAck, this.onMessageAck);
    socket.on(EventNames.MessageFail, this.onMessageFail);
  }

  detach() {
    if (!this.socket) return;
    this.socket.off('connect', this.onConnect);
    this.socket.off(EventNames.MessageNew, this.onMessageNew);
    this.socket.off(EventNames.MessageAck, this.onMessageAck);
    this.socket.off(EventNames.MessageFail, this.onMessageFail);
    this.socket = null;
    this.currentUserId = null;
  }

  /** Optimistically create a local pending row, then drain. */
  async enqueueSend(input: Omit<SendMessageInput, 'clientId'>): Promise<string> {
    if (!this.currentUserId) throw new Error('SyncEngine.enqueueSend before attach()');
    const clientId = uuid();
    const now = Date.now();

    await database.write(async () => {
      await collections.messages.create((m) => {
        m._raw.id = clientId; // WatermelonDB internal id — happens to double as client id
        (m as MessageModel).serverId = null;
        (m as MessageModel).clientId = clientId;
        (m as MessageModel).roomId = input.roomId;
        (m as MessageModel).authorId = this.currentUserId!;
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

  // ── Socket event handlers (bound to preserve `this`) ─────────────────────

  private onConnect = () => {
    logger.info(TAG, 'socket connected — draining outbox');
    void this.drain();
  };

  private onMessageAck = async (raw: unknown) => {
    const parsed = S2C_MessageAckSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(TAG, 'bad ack', parsed.error.issues);
      return;
    }
    const { clientId, serverId, createdAt } = parsed.data;
    const rows = await collections.messages.query(Q.where('client_id', clientId)).fetch();
    if (!rows.length) return;
    await database.write(async () => {
      for (const row of rows) {
        await row.update((m) => {
          (m as MessageModel).serverId = serverId;
          (m as MessageModel).status = 'sent';
          (m as MessageModel).createdAt = new Date(createdAt);
        });
      }
    });
    kv.setNumber(KvKeys.LastSyncedAt, Math.max(kv.getNumber(KvKeys.LastSyncedAt) ?? 0, createdAt));
  };

  private onMessageFail = async (raw: unknown) => {
    const parsed = S2C_MessageFailSchema.safeParse(raw);
    if (!parsed.success) return;
    const rows = await collections.messages.query(Q.where('client_id', parsed.data.clientId)).fetch();
    await database.write(async () => {
      for (const row of rows) {
        await row.update((m) => {
          (m as MessageModel).status = 'failed';
        });
      }
    });
  };

  private onMessageNew = async (raw: unknown) => {
    const parsed = S2C_MessageNewSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(TAG, 'bad message:new', parsed.error.issues);
      return;
    }
    const m = parsed.data.message;
    const existing = await collections.messages.query(Q.where('client_id', m.clientId)).fetch();
    await database.write(async () => {
      if (existing.length) {
        // own echo or duplicate — just promote to delivered.
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
        });
      }
    });
    kv.setNumber(KvKeys.LastSyncedAt, Math.max(kv.getNumber(KvKeys.LastSyncedAt) ?? 0, m.createdAt));
  };
}

export const syncEngine = new SyncEngine();
