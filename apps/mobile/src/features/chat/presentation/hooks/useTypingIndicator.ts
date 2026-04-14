/**
 * useTypingIndicator — handles both sending and receiving typing indicators.
 *
 * Sending: debounced emit of typing:start / typing:stop via getSocket().
 * Receiving: subscribes to SyncEngine event bus, filters by roomId,
 *            auto-expires after 4s if typing:stop is never received.
 *
 * All timer state lives in refs — zero re-renders from the sending side.
 * Only a single `visible` boolean drives the UI (edge-transition only).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { EventNames, type S2C_Typing } from '@rtc/contracts';

import { getSocket } from '../../../../foundation/network/socket';
import { onSyncEvent } from '../../data/SyncEngine';

/** Minimum gap between typing:start re-emits during continuous typing. */
const TYPING_EMIT_INTERVAL = 2500;
/** Inactivity timeout before auto-emitting typing:stop. */
const TYPING_STOP_DELAY = 3000;
/** Receiver-side auto-expire — clears the indicator if typing:stop is never received. */
const TYPING_EXPIRE_MS = 4000;

interface UseTypingIndicatorReturn {
  /** Whether someone in this room is currently typing. Feed to TypingDots. */
  visible: boolean;
  /** Callback for InputBar's onTypingChange prop. Debounce logic is encapsulated. */
  onTypingChange: (isTyping: boolean) => void;
}

export function useTypingIndicator(roomId: string): UseTypingIndicatorReturn {
  const [visible, setVisible] = useState(false);

  // ── Receiving state ──────────────────────────────────────────────────
  // Map<userId, timeoutHandle> — one entry per typing user with auto-expire
  const typersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // ── Sending state (all refs — no re-renders) ────────────────────────
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────

  const emitStart = useCallback(() => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(EventNames.TypingStart, { roomId });
    }
  }, [roomId]);

  const emitStop = useCallback(() => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(EventNames.TypingStop, { roomId });
    }
  }, [roomId]);

  const clearSendTimers = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (emitTimerRef.current) {
      clearInterval(emitTimerRef.current);
      emitTimerRef.current = null;
    }
  }, []);

  // ── Receiving: subscribe to SyncEngine event bus ─────────────────────
  useEffect(() => {
    const unsubscribe = onSyncEvent('typing', (payload) => {
      const data = payload as S2C_Typing;

      // Only process events for the current room
      if (data.roomId !== roomId) return;

      const typers = typersRef.current;
      const wasSomeoneTyping = typers.size > 0;

      if (data.typing) {
        // Clear existing expire timer for this user (if any) and set a new one
        const existingTimer = typers.get(data.userId);
        if (existingTimer) clearTimeout(existingTimer);

        const expireTimer = setTimeout(() => {
          typers.delete(data.userId);
          if (typers.size === 0) setVisible(false);
        }, TYPING_EXPIRE_MS);

        typers.set(data.userId, expireTimer);

        if (!wasSomeoneTyping) setVisible(true);
      } else {
        // typing: false — clear timer and remove user
        const existingTimer = typers.get(data.userId);
        if (existingTimer) clearTimeout(existingTimer);
        typers.delete(data.userId);

        if (wasSomeoneTyping && typers.size === 0) setVisible(false);
      }
    });

    return () => {
      unsubscribe();
      // Clear all expire timers on cleanup
      for (const timer of typersRef.current.values()) {
        clearTimeout(timer);
      }
      typersRef.current.clear();
      setVisible(false);
    };
  }, [roomId]);

  // ── Sending: cleanup on unmount or room change ───────────────────────
  useEffect(() => {
    return () => {
      // If user was typing when navigating away, emit stop
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitStop();
      }
      clearSendTimers();
    };
  }, [roomId, emitStop, clearSendTimers]);

  // ── Sending: the callback passed to InputBar ─────────────────────────
  const onTypingChange = useCallback(
    (typing: boolean) => {
      if (typing) {
        if (!isTypingRef.current) {
          // Transition IDLE → ACTIVE: emit start, begin re-emit interval
          isTypingRef.current = true;
          emitStart();

          emitTimerRef.current = setInterval(() => {
            if (isTypingRef.current) emitStart();
          }, TYPING_EMIT_INTERVAL);
        }

        // Always reset the inactivity stop timer on any keystroke
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        stopTimerRef.current = setTimeout(() => {
          // Transition ACTIVE → IDLE: inactivity timeout
          isTypingRef.current = false;
          emitStop();
          if (emitTimerRef.current) {
            clearInterval(emitTimerRef.current);
            emitTimerRef.current = null;
          }
        }, TYPING_STOP_DELAY);
      } else {
        // Explicit stop (text cleared, message sent, etc.)
        if (isTypingRef.current) {
          isTypingRef.current = false;
          emitStop();
        }
        clearSendTimers();
      }
    },
    [emitStart, emitStop, clearSendTimers],
  );

  return { visible, onTypingChange };
}
