import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AxiosError } from 'axios';

import { useAuthStore } from '../../../auth/presentation/state/authStore';
import type { RootStackParamList } from '../../../../navigation/types';
import {
  BottomSheet,
  Button,
  Icon,
  IconButton,
  Text,
  Toast,
  useTheme,
} from '../../../../ui';
import { patchProfile } from '../../data/profileApi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Field definitions ────────────────────────────────────────────────

type FieldKey = 'displayName' | 'bio' | 'email' | 'phone' | 'dateOfBirth' | 'location';

interface FieldDef {
  key: FieldKey;
  label: string;
  sheetTitle: string;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}

const FIELDS: Record<FieldKey, FieldDef> = {
  displayName: {
    key: 'displayName',
    label: 'DISPLAY NAME',
    sheetTitle: 'Display Name',
    placeholder: 'Enter your display name',
    maxLength: 64,
    autoCapitalize: 'words',
  },
  bio: {
    key: 'bio',
    label: 'BIO',
    sheetTitle: 'Bio',
    placeholder: 'Tell us about yourself',
    multiline: true,
    maxLength: 280,
    autoCapitalize: 'sentences',
  },
  email: {
    key: 'email',
    label: 'EMAIL',
    sheetTitle: 'Email',
    placeholder: 'your@email.com',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
  },
  phone: {
    key: 'phone',
    label: 'PHONE',
    sheetTitle: 'Phone',
    placeholder: '+1234567890',
    keyboardType: 'phone-pad',
  },
  dateOfBirth: {
    key: 'dateOfBirth',
    label: 'DATE OF BIRTH',
    sheetTitle: 'Date of Birth',
    placeholder: 'YYYY-MM-DD',
  },
  location: {
    key: 'location',
    label: 'LOCATION',
    sheetTitle: 'Location',
    placeholder: 'City, Country',
    maxLength: 100,
    autoCapitalize: 'words',
  },
};

// ── Masking helpers ──────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const domainParts = domain.split('.');
  const ext = domainParts.length > 1 ? `.${domainParts.slice(1).join('.')}` : '';
  const domainName = domainParts[0] ?? '';
  return `${local[0] ?? ''}••••@${domainName[0] ?? ''}••••${ext}`;
}

function maskPhone(phone: string): string {
  // Expect E.164 format like +12345678901
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.length < 4) return phone;
  // Find country code (everything up to last 10 digits, or first 1-3 chars after +)
  const last2 = digits.slice(-2);
  const codeEnd = Math.max(1, digits.length - 10);
  const code = digits.slice(0, codeEnd + 1); // include +
  return `${code} ${'••••'} ••${last2}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Main screen ──────────────────────────────────────────────────────

export function PersonalInfoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');

  const showToast = useCallback((message: string, variant: 'success' | 'error') => {
    setToastMessage(message);
    setToastVariant(variant);
    setToastVisible(true);
  }, []);

  // Edit sheet state
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = useCallback((key: FieldKey) => {
    const currentValue = user?.[key] ?? '';
    setEditValue(currentValue ?? '');
    setEditingField(key);
  }, [user]);

  const closeEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
    setSaving(false);
  }, []);

  const fieldDef = editingField ? FIELDS[editingField] : null;

  const originalValue = editingField ? (user?.[editingField] ?? '') : '';
  const hasChanged = editValue !== (originalValue ?? '');
  const hasCurrentValue = !!originalValue;

  const handleSave = useCallback(async () => {
    if (!editingField || !hasChanged) return;
    setSaving(true);
    try {
      const payload: Record<string, string | null | undefined> = {};
      // For displayName, send the value (cannot be null)
      if (editingField === 'displayName') {
        payload[editingField] = editValue.trim();
      } else {
        payload[editingField] = editValue.trim() || null;
      }
      const updatedUser = await patchProfile(payload);
      useAuthStore.setState({ user: updatedUser });
      closeEdit();
      showToast('Updated successfully', 'success');
    } catch (err) {
      let message = 'Something went wrong. Please try again.';
      if (err instanceof AxiosError && err.response?.data) {
        const data = err.response.data as { message?: string; error?: string };
        message = data.message ?? data.error ?? message;
      }
      showToast(message, 'error');
      setSaving(false);
    }
  }, [editingField, editValue, hasChanged, closeEdit, showToast]);

  const handleClear = useCallback(async () => {
    if (!editingField) return;
    setSaving(true);
    try {
      const payload: Record<string, null> = { [editingField]: null };
      const updatedUser = await patchProfile(payload);
      useAuthStore.setState({ user: updatedUser });
      closeEdit();
      showToast('Cleared successfully', 'success');
    } catch {
      showToast('Failed to clear. Please try again.', 'error');
      setSaving(false);
    }
  }, [editingField, closeEdit, showToast]);

  // Display values
  const displayValues = useMemo(() => ({
    displayName: user?.displayName ?? 'Not set',
    bio: user?.bio ?? null,
    email: user?.email ? maskEmail(user.email) : null,
    phone: user?.phone ? maskPhone(user.phone) : null,
    dateOfBirth: user?.dateOfBirth ? formatDate(user.dateOfBirth) : null,
    location: user?.location ?? null,
  }), [user]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          size={22}
          color="text"
          onPress={() => navigation.goBack()}
        />
        <Text variant="titleSm" style={{ flex: 1, marginLeft: 12 }}>
          Personal Information
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Identity Section */}
        <SectionCard title="Identity" theme={theme}>
          <FieldRow
            label={FIELDS.displayName.label}
            value={displayValues.displayName}
            muted={!user?.displayName}
            onPress={() => openEdit('displayName')}
            theme={theme}
          />
          <RowDivider theme={theme} />
          <FieldRow
            label={FIELDS.bio.label}
            value={displayValues.bio}
            placeholder="Add a bio"
            placeholderItalic
            numberOfLines={2}
            onPress={() => openEdit('bio')}
            theme={theme}
          />
        </SectionCard>

        {/* Contact Section */}
        <SectionCard title="Contact" theme={theme}>
          <FieldRow
            label={FIELDS.email.label}
            value={displayValues.email}
            placeholder="Not set"
            onPress={() => openEdit('email')}
            theme={theme}
          />
          <RowDivider theme={theme} />
          <FieldRow
            label={FIELDS.phone.label}
            value={displayValues.phone}
            placeholder="Not set"
            onPress={() => openEdit('phone')}
            theme={theme}
          />
        </SectionCard>

        {/* Personal Section */}
        <SectionCard title="Personal" theme={theme}>
          <FieldRow
            label={FIELDS.dateOfBirth.label}
            value={displayValues.dateOfBirth}
            placeholder="Not set"
            onPress={() => openEdit('dateOfBirth')}
            theme={theme}
          />
          <RowDivider theme={theme} />
          <FieldRow
            label={FIELDS.location.label}
            value={displayValues.location}
            placeholder="Not set"
            onPress={() => openEdit('location')}
            theme={theme}
          />
        </SectionCard>

        {/* Footer */}
        <Text
          variant="micro"
          color="textMuted"
          align="center"
          style={{ marginTop: theme.spacing.xl, paddingHorizontal: theme.spacing.xl }}
        >
          Your personal information is private and only visible to you.
        </Text>
      </ScrollView>

      {/* Edit Bottom Sheet */}
      <BottomSheet visible={editingField !== null} onClose={closeEdit}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
            {/* Sheet title */}
            <Text variant="title" style={{ marginBottom: theme.spacing.lg }}>
              {fieldDef?.sheetTitle ?? ''}
            </Text>

            {/* Input */}
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              placeholder={fieldDef?.placeholder}
              placeholderTextColor={theme.colors.textMuted}
              multiline={fieldDef?.multiline}
              maxLength={fieldDef?.maxLength}
              keyboardType={fieldDef?.keyboardType ?? 'default'}
              autoCapitalize={fieldDef?.autoCapitalize ?? 'sentences'}
              autoFocus
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceContainerHigh,
                  borderRadius: theme.radii.sm,
                  color: theme.colors.text,
                  minHeight: fieldDef?.multiline ? 100 : undefined,
                  textAlignVertical: fieldDef?.multiline ? 'top' : 'center',
                },
              ]}
            />

            {/* Character counter for bio */}
            {fieldDef?.key === 'bio' && (
              <Text
                variant="micro"
                color="textMuted"
                style={{ alignSelf: 'flex-end', marginTop: 6 }}
              >
                {editValue.length} / 280
              </Text>
            )}

            {/* Save button */}
            <View style={{ marginTop: theme.spacing.lg }}>
              <Button
                label="Save"
                onPress={handleSave}
                disabled={!hasChanged || saving}
                loading={saving}
              />
            </View>

            {/* Clear button */}
            {hasCurrentValue && editingField !== 'displayName' && (
              <Pressable
                onPress={handleClear}
                disabled={saving}
                style={{ alignSelf: 'center', marginTop: theme.spacing.md, paddingVertical: 8 }}
              >
                <Text
                  variant="caption"
                  style={{ color: theme.colors.danger, fontWeight: '600', opacity: saving ? 0.5 : 1 }}
                >
                  Clear
                </Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        variant={toastVariant}
        onHide={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionCard({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginHorizontal: theme.spacing.xl, marginTop: theme.spacing.lg }}>
      <Text
        variant="micro"
        color="textMuted"
        style={{
          marginBottom: theme.spacing.sm,
          marginLeft: theme.spacing.xs,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: theme.colors.surfaceContainerLowest,
          borderRadius: theme.radii.md,
          padding: theme.spacing.lg,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function FieldRow({
  label,
  value,
  placeholder = 'Not set',
  placeholderItalic = false,
  numberOfLines = 1,
  muted = false,
  onPress,
  theme,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  placeholderItalic?: boolean;
  numberOfLines?: number;
  muted?: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const isEmpty = !value;
  return (
    <Pressable onPress={onPress} style={styles.fieldRow}>
      <View style={{ flex: 1 }}>
        <Text
          variant="micro"
          color="textMuted"
          style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
        >
          {label}
        </Text>
        <Text
          variant="body"
          color={isEmpty || muted ? 'textMuted' : 'text'}
          numberOfLines={numberOfLines}
          style={[
            { marginTop: 2 },
            isEmpty && placeholderItalic && { fontStyle: 'italic' },
          ]}
        >
          {value ?? placeholder}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color="textMuted" />
    </Pressable>
  );
}

function RowDivider({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.outlineVariant,
        marginVertical: theme.spacing.md,
      }}
    />
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
