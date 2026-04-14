import { Q } from '@nozbe/watermelondb';

import { EventNames, type Message } from '@rtc/contracts';

import { http } from '../../../foundation/network/http';
import { getSocket } from '../../../foundation/network/socket';
import { collections, database } from '../../../foundation/storage';
import type { MessageModel } from '../../../foundation/storage/models/MessageModel';
import { logger } from '../../../lib/logger';

import { syncEngine } from './SyncEngine';

export const messageRepository = {
  async send(roomId: string, body: string, replyToId?: string): Promise<string> {
    return syncEngine.enqueueSend({ roomId, body, kind: 'text', ...(replyToId ? { replyToId } : {}) });
  },

  joinRoom(roomId: string): void {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(EventNames.RoomJoin, { roomId });
    }
  },

  leaveRoom(roomId: string): void {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(EventNames.RoomLeave, { roomId });
    }
  },

  /** Send a read receipt indicating the user has seen messages up to the given message. */
  sendReadReceipt(roomId: string, upToMessageId: string): void {
    syncEngine.sendReadReceipt(roomId, upToMessageId);
  },

  /** Retry a failed message by resetting its status and re-draining the outbox. */
  async retry(clientId: string): Promise<void> {
    const rows = await collections.messages
      .query(Q.where('client_id', clientId))
      .fetch();

    if (!rows.length) {
      logger.warn('MessageRepo', `retry: message not found for clientId=${clientId}`);
      return;
    }

    await database.write(async () => {
      for (const row of rows) {
        await row.update((m) => {
          (m as MessageModel).status = 'pending';
        });
      }
    });

    // Re-drain the outbox so the SyncEngine picks up the message
    void syncEngine.drain();
  },

  /** Delete a message (soft-delete). Optimistically marks as deleted locally, then emits to server. */
  async deleteMessage(serverId: string, roomId: string): Promise<void> {
    // Optimistic: mark as deleted locally
    const rows = await collections.messages
      .query(Q.where('server_id', serverId))
      .fetch();

    if (rows.length) {
      await database.write(async () => {
        for (const row of rows) {
          await row.update((m) => {
            (m as MessageModel).body = '';
            (m as MessageModel).deletedAt = new Date();
          });
        }
      });
    }

    // Emit to server
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(EventNames.MessageDelete, { messageId: serverId, roomId });
    }
  },

  /**
   * Fetch message history from the server and reconcile with WatermelonDB.
   * Called when a ChatRoom is opened so that messages missed while offline
   * are backfilled into the local database.
   */
  async fetchHistory(roomId: string): Promise<void> {
    try {
      const { data: messages } = await http.get<Message[]>(`/rooms/${roomId}/messages`);
      if (!messages.length) return;

      await database.write(async () => {
        for (const m of messages) {
          const existing = await collections.messages
            .query(Q.where('client_id', m.clientId))
            .fetch();

          if (existing.length) {
            // Update existing local message with server state.
            // Never downgrade status: pending < sent < delivered < read.
            const PRIORITY: Record<string, number> = {
              pending: 0, sent: 1, delivered: 2, read: 3, failed: -1,
            };
            const localPriority = PRIORITY[existing[0].status] ?? 0;
            const serverPriority = PRIORITY[m.status] ?? 0;
            const shouldPromote = serverPriority > localPriority;

            await existing[0].update((r) => {
              (r as MessageModel).serverId = m.id;
              if (shouldPromote) {
                (r as MessageModel).status = m.status;
              }
              if (m.deletedAt) {
                (r as MessageModel).body = '';
                (r as MessageModel).deletedAt = new Date(m.deletedAt);
              }
            });
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
        }
      });

      logger.info('MessageRepo', `backfilled ${messages.length} messages for room ${roomId}`);
    } catch (err) {
      logger.error('MessageRepo', 'fetchHistory failed', err);
    }
  },
};
