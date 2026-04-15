import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { ConnectionRequestWithUser } from '@rtc/contracts';

import { Avatar, PressableScale, Text, useTheme } from '../../../../ui';

// ── Helpers ─────────────────────────────────────────────────────────────

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function formatRelativeTime(dateInput: number | string): string {
  const then = typeof dateInput === 'string' ? new Date(dateInput).getTime() : dateInput;
  const diff = Date.now() - then;

  if (diff < MINUTE) return 'JUST NOW';
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins}M AGO`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}H AGO`;
  }
  const days = Math.floor(diff / DAY);
  return `${days}D AGO`;
}

// ── Props ───────────────────────────────────────────────────────────────

interface ConnectionRequestCardProps {
  request: ConnectionRequestWithUser;
  acting: boolean;
  onAccept: () => void;
  onIgnore: () => void;
}

// ── Component ───────────────────────────────────────────────────────────

export function ConnectionRequestCard({
  request,
  acting,
  onAccept,
  onIgnore,
}: ConnectionRequestCardProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderColor: theme.colors.outlineVariant + '20',
        },
      ]}
    >
      {/* ── Top Row ──────────────────────────────────────────────── */}
      <View style={styles.topRow}>
        <Avatar
          uri={request.sender.avatarUrl ?? undefined}
          name={request.sender.displayName}
          size={52}
        />
        <View style={styles.nameColumn}>
          <Text variant="titleSm">{request.sender.displayName}</Text>
          <Text variant="micro" color="textMuted" style={styles.handle}>
            @{request.sender.handle}
          </Text>
        </View>
        <Text variant="micro" color="textMuted">
          {formatRelativeTime(request.createdAt)}
        </Text>
      </View>

      {/* ── Note Quote ───────────────────────────────────────────── */}
      {request.message != null && (
        <View
          style={[
            styles.noteQuote,
            {
              backgroundColor: theme.colors.primaryContainer + '15',
              borderLeftColor: theme.colors.primaryContainer,
            },
          ]}
        >
          <Text
            variant="caption"
            color="textSecondary"
            style={styles.noteText}
          >
            {'\u201C'}{request.message}{'\u201D'}
          </Text>
        </View>
      )}

      {/* ── Action Buttons ───────────────────────────────────────── */}
      <View style={styles.actions}>
        <PressableScale
          scaleTo={0.96}
          onPress={onAccept}
          disabled={acting}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.inverseSurface,
              opacity: acting ? 0.5 : 1,
            },
          ]}
        >
          <Text
            variant="caption"
            style={[styles.buttonLabel, { color: theme.colors.inverseOnSurface }]}
          >
            Accept
          </Text>
        </PressableScale>

        <PressableScale
          scaleTo={0.96}
          onPress={onIgnore}
          disabled={acting}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.surfaceContainerHigh,
              opacity: acting ? 0.5 : 1,
            },
          ]}
        >
          <Text
            variant="caption"
            color="textSecondary"
            style={styles.buttonLabel}
          >
            Ignore
          </Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    // Whisper Shadow
    shadowColor: '#2d2f2f',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 40,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameColumn: {
    flex: 1,
    marginLeft: 14,
  },
  handle: {
    marginTop: 2,
  },
  noteQuote: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 3,
  },
  noteText: {
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontWeight: '600',
  },
});
