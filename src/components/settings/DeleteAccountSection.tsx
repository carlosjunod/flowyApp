import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useChat } from '@/hooks/useChat';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

// Account deletion — App Store Review 5.1.1(v) requires an app that offers
// account creation to offer in-app deletion.
//
// The gate is a typed phrase rather than the account's email address: users who
// signed in with Apple under "Hide My Email" only ever have an opaque
// @privaterelay.appleid.com address, which nobody can recall or type. The same
// phrase is used on web so the two surfaces behave identically.

// NOT translated: the server compares this phrase literally, so a Spanish
// variant would fail the check and make deletion impossible. The instruction
// around it is translated; the phrase the user types is not.
const CONFIRMATION_PHRASE = 'delete my account';

const DESTROYED_KEYS = [
  'settings.deleteAccount.destroyed1',
  'settings.deleteAccount.destroyed2',
  'settings.deleteAccount.destroyed3',
  'settings.deleteAccount.destroyed4',
  'settings.deleteAccount.destroyed5',
] as const;

export const DeleteAccountSection: React.FC = () => {
  const { signOut } = useAuth();
  const chat = useChat();
  const { t } = useI18n();
  const colors = useResolvedColors();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<
    'settings.deleteAccount.phraseMismatch' | 'settings.deleteAccount.failed' | null
  >(null);

  const matches = phrase.trim().toLowerCase() === CONFIRMATION_PHRASE;

  const onDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setErrorKey(null);
    const res = await api.deleteAccount(phrase.trim());
    if (res.error) {
      setErrorKey(
        res.error.code === 'CONFIRMATION_MISMATCH'
          ? 'settings.deleteAccount.phraseMismatch'
          : 'settings.deleteAccount.failed',
      );
      setBusy(false);
      return;
    }
    // Clears the PocketBase session AND the shared keychain entry, so the
    // share extension loses its session too rather than posting as a user
    // that no longer exists.
    try { await chat.removeAccountHistory(); } catch { Alert.alert(t('settings.deleteAccount.localChatTitle'), t('settings.deleteAccount.localChatBody')); }
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
          <Text className="text-base text-danger">{t('settings.deleteAccount.title')}</Text>
          <Text className="text-xs text-muted mt-1">
            {t('settings.deleteAccount.summary')}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    );
  }

  return (
    <View className="rounded-xl border border-danger/40 px-4 py-4 gap-3">
      <Text className="text-base text-danger">{t('settings.deleteAccount.title')}</Text>

      <View className="gap-1">
        <Text className="text-xs text-fg">{t('settings.deleteAccount.willDestroy')}</Text>
        {DESTROYED_KEYS.map((key) => (
          <Text key={key} className="text-xs text-muted">
            {'•  '}
            {t(key)}
          </Text>
        ))}
      </View>

      <View className="gap-1.5">
        <Text className="text-xs text-muted">
          {t('settings.deleteAccount.typeBefore')}
          <Text className="text-fg">{CONFIRMATION_PHRASE}</Text>
          {t('settings.deleteAccount.typeAfter')}
        </Text>
        <TextInput
          value={phrase}
          onChangeText={setPhrase}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          accessibilityLabel={t('settings.deleteAccount.phraseLabel')}
          placeholder={CONFIRMATION_PHRASE}
          placeholderTextColor={colors.muted}
          className="rounded-lg border border-border bg-card px-3 py-2.5 text-base text-fg"
          style={{ color: colors.fg }}
        />
      </View>

      {errorKey ? (
        <Text accessibilityRole="alert" className="text-xs text-danger">
          {t(errorKey)}
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
            <Text className="text-sm font-semibold text-white">{t('settings.deleteAccount.deleteForever')}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            setOpen(false);
            setPhrase('');
            setErrorKey(null);
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          className="items-center justify-center rounded-lg border border-border px-4 py-3"
        >
          <Text className="text-sm text-muted">{t('settings.deleteAccount.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
};
