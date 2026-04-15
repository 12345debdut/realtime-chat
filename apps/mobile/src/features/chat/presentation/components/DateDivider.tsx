import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text, useTheme } from '../../../../ui';

// ── Helpers ──────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatDateLabel(date: Date): string {
  const now = new Date();

  if (isSameDay(date, now)) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return `${ordinal(date.getDate())} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

/**
 * Returns true if two timestamps fall on different calendar days,
 * meaning a divider should be shown between them.
 */
export function shouldShowDivider(
  currentTs: number,
  nextTs: number | undefined,
): boolean {
  if (nextTs == null) return true; // first message in list → always show
  const a = new Date(currentTs);
  const b = new Date(nextTs);
  return !isSameDay(a, b);
}

// ── Component ────────────────────────────────────────────────────────────

interface DateDividerProps {
  timestamp: number;
}

export const DateDivider = React.memo(function DateDivider({ timestamp }: DateDividerProps) {
  const theme = useTheme();
  const label = formatDateLabel(new Date(timestamp));

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: theme.colors.outlineVariant + '30' }]} />
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
          },
        ]}
      >
        <Text
          variant="label"
          style={{ color: theme.colors.textMuted }}
        >
          {label}
        </Text>
      </View>
      <View style={[styles.line, { backgroundColor: theme.colors.outlineVariant + '30' }]} />
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginHorizontal: 12,
  },
});
