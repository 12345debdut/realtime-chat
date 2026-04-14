import { useCallback, useEffect, useRef, useState } from 'react';

import { collections } from '../../../../foundation/storage';
import type { RoomModel } from '../../../../foundation/storage/models/RoomModel';
import { syncEngine } from '../../data/SyncEngine';

export function useRooms() {
  const [rooms, setRooms] = useState<RoomModel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Tracks whether the WatermelonDB observable has emitted at least once.
  // Until it does, the UI should not render an empty state.
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const sub = collections.rooms
      .query()
      .observeWithColumns(['is_pinned', 'last_message_at', 'last_message_preview', 'title', 'updated_at', 'unread_count'])
      .subscribe((result) => {
        setRooms(result);
        if (!hydratedRef.current) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      });

    // Background sync on mount — keeps rooms fresh without blocking the UI.
    // DB data shows instantly; server data merges in when it arrives.
    syncEngine.syncRooms().catch(() => {});

    return () => sub.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await syncEngine.syncRooms();
    setRefreshing(false);
  }, []);

  return { rooms, refreshing, refresh, hydrated };
}
