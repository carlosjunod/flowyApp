import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useResolvedColors } from '@/lib/theme';

// Account deletion — App Store Review 5.1.1(v) requires an app that offers
// account creation to offer in-app deletion.
//
// The gate is a typed phrase rather than the account's email address: users who
// signed in with Apple under "Hide My Email" only ever have an opaque
// @privaterelay.appleid.com address, which nobody can recall or type. The same
// phrase is used on web so the two surfaces behave identically.

const CONFIRMATION_PHRASE = 'delete my account';

const DESTROYED = [
  'Your account and sign-in details',
  'Every item you saved, with its summaries, tags and notes',
  'Every file you uploaded',
  'Your search index, digests and notifications',
];

export const DeleteAccountSection: React.FC = () => {
  const { signOut } = useAuth();
  const colors = useResolvedColors();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = phrase.trim().toLowerCase() === CONFIRMATION_PHRASE;

  const onDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    const res = await api.deleteAccount(phrase.trim());
    if (res.error) {
      setError(
        res.error.code === 'CONFIRMATION_MISMATCH'
          ? 'That phrase does not match.'
          : 'We could not delete your account. Please try again.',
      );
      setBusy(false);
      return;
    }
    // Clears the PocketBase session AND the shared keychain entry, so the
    // share extension loses its session too rather than posting as a user
    // that no longer exists.
    await signOut();
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        className="rounded-xl border border-danger/40 px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-1">
          <Text className="text-base text-danger">Delete account</Text>
          <Text className="text-xs text-muted mt-1">
            Permanently deletes everything. Cannot be undone.
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <View className="rounded-xl border border-danger/40 px-4 py-4 gap-3">
      <Text className="text-base text-danger">Delete account</Text>

      <View className="gap-1">
        <Text className="text-xs text-fg">This will destroy:</Text>
        {DESTROYED.map((line) => (
          <Text key={line} className="text-xs text-muted">
            {'•  '}
            {line}
          </Text>
        ))}
      </View>

      <View className="gap-1.5">
        <Text className="text-xs text-muted">
          Type <Text className="text-fg">{CONFIRMATION_PHRASE}</Text> to confirm.
        </Text>
        <TextInput
          value={phrase}
          onChangeText={setPhrase}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel="Type the confirmation phrase"
          placeholder={CONFIRMATION_PHRASE}
          placeholderTextColor={colors.muted}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-base text-fg"
          style={{ color: colors.fg }}
        />
      </View>

      {error ? (
        <Text accessibilityRole="alert" className="text-xs text-danger">
          {error}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={onDelete}
          disabled={!matches || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !matches || busy }}
          style={({ pressed }) => [
            { opacity: !matches || busy ? 0.4 : pressed ? 0.8 : 1, backgroundColor: colors.danger },
          ]}
          className="flex-1 items-center justify-center rounded-lg py-3"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-sm font-semibold text-white">Delete forever</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setOpen(false);
            setPhrase('');
            setError(null);
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          className="items-center justify-center rounded-lg border border-border px-4 py-3"
        >
          <Text className="text-sm text-muted">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};
