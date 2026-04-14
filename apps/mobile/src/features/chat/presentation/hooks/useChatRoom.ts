import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Q } from '@nozbe/watermelondb';

import { collections, database } from '../../../../foundation/storage';
import type { RoomModel } from '../../../../foundation/storage/models/RoomModel';
import { kv, KvKeys } from '../../../../foundation/storage/kv';
import { logger } from '../../../../lib/logger';
import { messageRepository } from '../../data/MessageRepository';
import { syncEngine } from '../../data/SyncEngine';

import { useMessages } from './useMessages';

export function useChatRoom(roomId: string) {
  const messages = useMessages(roomId);
  const currentUserId = useMemo(() => kv.getString(KvKeys.CurrentUserId) ?? '', []);
  const lastReadRef = useRef<string | null>(null);

  // Set active room for unread count logic + optimistic reset to 0
  useEffect(() => {
    syncEngine.setActiveRoom(roomId);

    // Optimistically clear unread badge when opening the room
    (async () => {
      try {
        const roomRows = await collections.rooms
          .query(Q.where('server_id', roomId))
          .fetch();
        if (roomRows.length && roomRows[0].unreadCount > 0) {
          await database.write(async () => {
            await roomRows[0].update((r) => {
              (r as RoomModel).unreadCount = 0;
            });
          });
        }
      } catch (err) {
        logger.error('useChatRoom', 'clear unread failed', err);
      }
    })();

    return () => {
      syncEngine.setActiveRoom(null);
    };
  }, [roomId]);

  useEffect(() => {
    // Backfill messages from server so messages missed while offline appear.
    // Room joining/leaving is handled by syncEngine.setActiveRoom() above.
    messageRepository.fetchHistory(roomId).catch((err) => {
      logger.error('useChatRoom', 'fetchHistory failed', err);
    });
  }, [roomId]);

  // Send read receipt for the latest message from the other person
  useEffect(() => {
    if (!messages.length || !currentUserId) return;

    // Find the latest message from someone else that has a serverId
    const latestFromOther = messages.find(
      (m) => m.authorId !== currentUserId && m.serverId,
    );
    if (!latestFromOther || !latestFromOther.serverId) return;

    // Don't re-send if we already sent a receipt for this message
    if (lastReadRef.current === latestFromOther.serverId) return;
    lastReadRef.current = latestFromOther.serverId;

    messageRepository.sendReadReceipt(roomId, latestFromOther.serverId);
  }, [messages, roomId, currentUserId]);

  const send = useCallback(
    (body: string, replyToId?: string) => {
      messageRepository.send(roomId, body, replyToId).catch((err) => {
        logger.error('useChatRoom', 'send failed', err);
      });
    },
    [roomId],
  );

  const retry = useCallback((clientId: string) => {
    messageRepository.retry(clientId).catch((err) => {
      logger.error('useChatRoom', 'retry failed', err);
    });
  }, []);

  return { messages, currentUserId, send, retry };
}
