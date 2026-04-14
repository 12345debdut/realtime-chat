/**
 * Observes a room's messages from WatermelonDB, re-emitting on every change.
 * Using raw observables (rather than withObservables HOC) keeps the screen
 * code tidy and avoids unnecessary re-renders outside the FlashList.
 */
import { useEffect, useState } from 'react';

import { Q } from '@nozbe/watermelondb';

import { collections } from '../../../../foundation/storage';
import type { MessageModel } from '../../../../foundation/storage/models/MessageModel';

export function useMessages(roomId: string): MessageModel[] {
  const [messages, setMessages] = useState<MessageModel[]>([]);

  useEffect(() => {
    const sub = collections.messages
      .query(Q.where('room_id', roomId), Q.sortBy('created_at', Q.desc))
      .observeWithColumns(['status', 'server_id', 'deleted_at', 'body'])
      .subscribe(setMessages);
    return () => sub.unsubscribe();
  }, [roomId]);

  return messages;
}
