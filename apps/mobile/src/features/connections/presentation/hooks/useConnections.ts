import { useCallback, useEffect, useState } from 'react';

import type {
  ConnectionRequestWithUser,
  S2C_ConnectionRequestRevoked,
  SentConnectionRequestWithUser,
} from '@rtc/contracts';
import { S2C_ConnectionRequestNewSchema } from '@rtc/contracts';

import { onSyncEvent } from '../../../chat/data/SyncEngine';
import { connectionRepository, type AcceptResult } from '../../data/ConnectionRepository';
import { usePendingCount } from '../state/pendingCountStore';

export function useConnections() {
  const [requests, setRequests] = useState<ConnectionRequestWithUser[]>([]);
  const [sentRequests, setSentRequests] = useState<SentConnectionRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentLoading, setSentLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // ── Fetch received pending requests ─────────────────────────────────────
  const fetchPending = useCallback(async () => {
    try {
      const data = await connectionRepository.getPending();
      setRequests(data);
      usePendingCount.getState().set(data.length);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Fetch sent pending requests ─────────────────────────────────────────
  const fetchSent = useCallback(async () => {
    try {
      const data = await connectionRepository.getSent();
      setSentRequests(data);
    } catch {
      // ignore
    } finally {
      setSentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    fetchSent();
  }, [fetchPending, fetchSent]);

  // ── Listen for realtime events from SyncEngine ─────────────────────────
  useEffect(() => {
    const unsubRevoked = onSyncEvent('connection:request:revoked', (payload) => {
      const { requestId } = payload as S2C_ConnectionRequestRevoked;
      // Remove from received list (receiver sees the revoke in realtime)
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      usePendingCount.getState().decrement();
    });

    const unsubNew = onSyncEvent('connection:request:new', (raw) => {
      const parsed = S2C_ConnectionRequestNewSchema.safeParse(raw);
      if (parsed.success) {
        setRequests((prev) => {
          // Avoid duplicates
          if (prev.some((r) => r.id === parsed.data.request.id)) return prev;
          usePendingCount.getState().increment();
          return [parsed.data.request, ...prev];
        });
      }
    });

    const unsubExpired = onSyncEvent('connection:request:expired', (payload) => {
      const { requestId } = payload as { requestId: string };
      // Remove from sent list (sender sees the ignore as a neutral "expired" event)
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    });

    return () => {
      unsubRevoked();
      unsubNew();
      unsubExpired();
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────
  const accept = useCallback(
    async (requestId: string): Promise<AcceptResult | null> => {
      try {
        setActing(requestId);
        const result = await connectionRepository.accept(requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        usePendingCount.getState().decrement();
        return result;
      } catch {
        return null;
      } finally {
        setActing(null);
      }
    },
    [],
  );

  const ignore = useCallback(async (requestId: string) => {
    try {
      setActing(requestId);
      await connectionRepository.ignore(requestId);
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      usePendingCount.getState().decrement();
    } catch {
      // ignore
    } finally {
      setActing(null);
    }
  }, []);

  const revoke = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      setRevoking(requestId);
      await connectionRepository.revoke(requestId);
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      return true;
    } catch {
      return false;
    } finally {
      setRevoking(null);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchPending();
    fetchSent();
  }, [fetchPending, fetchSent]);

  return {
    requests,
    sentRequests,
    loading,
    sentLoading,
    refreshing,
    acting,
    revoking,
    accept,
    ignore,
    revoke,
    refresh,
    fetchSent,
  };
}
