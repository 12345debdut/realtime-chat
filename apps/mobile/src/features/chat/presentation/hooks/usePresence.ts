import { useEffect, useMemo, useState } from 'react';

import { Q } from '@nozbe/watermelondb';

import { collections } from '../../../../foundation/storage';
import { kv, KvKeys } from '../../../../foundation/storage/kv';
import { getCachedPresence, onSyncEvent, syncEngine } from '../../data/SyncEngine';

interface PresencePayload {
  userId: string;
  online: boolean;
  lastSeenAt: number | null;
}

/**
 * Returns the online status of the peer in a DM room.
 *
 * Initialises from the in-memory presence cache (written by SyncEngine
 * on every presence event) so the UI shows the last known state instantly
 * — no flash of "Offline" before the server responds.
 *
 * After the peer is resolved and the event-bus subscription is live,
 * a fresh presence request is sent to the server. If the server's answer
 * differs from the cache, the state is updated; otherwise nothing changes.
 *
 * @param roomId - The **server** room ID (from route params).
 */
export function usePresence(roomId: string): {
  online: boolean;
  lastSeenAt: number | null;
} {
  const currentUserId = useMemo(() => kv.getString(KvKeys.CurrentUserId) ?? '', []);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);

  // Resolve the peer userId from the room's memberships
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const roomRows = await collections.rooms
        .query(Q.where('server_id', roomId))
        .fetch();
      if (!roomRows.length || cancelled) return;

      const localRoomId = roomRows[0].id;
      const memberships = await collections.memberships
        .query(Q.where('room_id', localRoomId))
        .fetch();
      const peer = memberships.find((m) => m.userId !== currentUserId);
      if (!cancelled && peer) {
        // Initialise from cache immediately — no round-trip needed.
        const cached = getCachedPresence(peer.userId);
        if (cached) {
          setOnline(cached.online);
          setLastSeenAt(cached.lastSeenAt);
        }
        setPeerId(peer.userId);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, currentUserId]);

  // Subscribe to presence events for the peer, then request fresh status.
  useEffect(() => {
    if (!peerId) return;

    const unsub = onSyncEvent('presence', (payload: unknown) => {
      const p = payload as PresencePayload;
      if (p.userId !== peerId) return;
      setOnline(p.online);
      if (!p.online && p.lastSeenAt) {
        setLastSeenAt(p.lastSeenAt);
      }
    });

    // Now that we're listening, re-emit room:join so the server sends
    // fresh presence for all members. This is idempotent on the server.
    syncEngine.requestPresence(roomId);

    return unsub;
  }, [peerId, roomId]);

  return { online, lastSeenAt };
}
