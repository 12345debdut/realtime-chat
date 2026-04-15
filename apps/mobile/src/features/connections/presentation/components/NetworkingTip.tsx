import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Text, useTheme } from '../../../../ui';

export function NetworkingTip() {
  const theme = useTheme();
  const accentColor = theme.colors.bubbleSelfText;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]}>
      <View style={styles.labelRow}>
        <MaterialCommunityIcons
          name="lightbulb-outline"
          size={16}
          color={accentColor}
        />
        <Text variant="label" style={{ color: accentColor }}>
          NETWORKING TIP
        </Text>
      </View>

      <Text variant="title" style={[styles.title, { color: accentColor }]}>
        Keep it Editorial
      </Text>

      <Text
        variant="caption"
        style={[styles.body, { color: accentColor + 'cc' }]}
      >
        When reaching out to new curators, keep your intro message brief and
        specific. Mention a particular piece of work that resonated with you to
        establish an immediate, meaningful connection.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginTop: 32,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  title: {
    marginBottom: 8,
  },
  body: {
    lineHeight: 20,
  },
});
