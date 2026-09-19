import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { usePersonalization } from '@/hooks/usePersonalization';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { hasPersonalization, initialPersonalizationDraft, normalizePersonalization, PERSONALIZATION_LIMITS, personalizationDraft, personalizationErrorKey } from '@/lib/personalization';
import { useResolvedColors } from '@/lib/theme';
import type { PersonalizationInput } from '@/types';

export default function PersonalizationScreen() {
  const { user } = useAuth();
  return user ? <PersonalizationForm key={user.id} accountId={user.id} /> : null;
}

function PersonalizationForm({ accountId }: { accountId: string }) {
  const profile = usePersonalization(accountId);
  const { t, tKey } = useI18n();
  const colors = useResolvedColors();
  const [draft, setDraft] = useState<PersonalizationInput | null>(null);
  // A key rather than a sentence, so the notice follows a language switch.
  const [messageKey, setMessageKey] = useState('');
  const [reloading, setReloading] = useState(false);
  const { refetch } = profile;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => {
    if (profile.data) setDraft(previous => previous ?? initialPersonalizationDraft(profile.data));
  }, [profile.data]);
  const conflict = profile.mutationError?.code === 'PERSONALIZATION_CONFLICT' || profile.mutationError?.status === 409;
  const busy = profile.pending || reloading;
  const dirty = !!draft && !!profile.data && JSON.stringify(normalizePersonalization(draft)) !== JSON.stringify(personalizationDraft(profile.data));

  function change<K extends keyof PersonalizationInput>(key: K, value: PersonalizationInput[K]) {
    setMessageKey('');
    setDraft(previous => previous ? { ...previous, [key]: value } : previous);
  }
  async function save() {
    if (!draft) return;
    setMessageKey('');
    const saved = await profile.save({ ...normalizePersonalization(draft), onboardingDismissed: true });
    if (saved) {
      setDraft(personalizationDraft(saved));
      setMessageKey(saved.enabled ? 'settings.personalization.savedEnabled' : 'settings.personalization.savedPaused');
    }
  }
  async function reload() {
    setReloading(true);
    setMessageKey('');
    const result = await profile.refetch();
    setReloading(false);
    if (result.isSuccess && result.data) {
      setDraft(personalizationDraft(result.data));
      profile.resetMutationError();
      setMessageKey('settings.personalization.reloaded');
    } else setMessageKey('settings.personalization.reloadFailed');
  }
  function confirmReload() {
    Alert.alert(t('settings.personalization.reloadTitle'), t('settings.personalization.reloadBody'), [
      { text: t('settings.personalization.keepEditing'), style: 'cancel' },
      { text: t('settings.personalization.reload'), onPress: () => { void reload(); } },
    ]);
  }
  function clear() {
    if (!draft) return;
    const revision = draft.revision;
    Alert.alert(t('settings.personalization.clearTitle'), t('settings.personalization.clearBody'), [
      { text: t('settings.personalization.cancel'), style: 'cancel' },
      { text: t('settings.personalization.clear'), style: 'destructive', onPress: async () => {
        setMessageKey('');
        const saved = await profile.clear(revision);
        if (saved) {
          setDraft(personalizationDraft(saved));
          setMessageKey('settings.personalization.cleared');
        }
      } },
    ]);
  }
  function goBack() {
    if (!dirty) { router.back(); return; }
    Alert.alert(t('settings.personalization.leaveTitle'), t('settings.personalization.leaveBody'), [
      { text: t('settings.personalization.keepEditing'), style: 'cancel' },
      { text: t('settings.personalization.leave'), onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 flex-row items-center border-b border-border">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={t('settings.personalization.back')} className="min-h-11 flex-row items-center gap-1 pr-4">
          <Feather name="chevron-left" size={20} color={colors.fg} /><Text className="text-fg">{t('settings.personalization.back')}</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 24, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-fg" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 34 }}>{t('settings.personalization.title')}</Text>
            <Text className="text-muted leading-6">{t('settings.personalization.intro')}</Text>
          </View>
          {!draft ? profile.isFetching ? <View className="flex-row items-center gap-3"><Spinner /><Text className="text-muted">{t('settings.personalization.loading')}</Text></View> : (
            <View className="gap-3"><Text accessibilityRole="alert" className="text-danger">{t('settings.personalization.loadFailed')}</Text><Button title={t('settings.personalization.retryLoading')} variant="secondary" onPress={() => { void profile.refetch(); }} /></View>
          ) : (
            <>
              <Question label={t('settings.personalization.occupationLabel')} hint={t('settings.personalization.occupationHint')} value={draft.occupation} field="occupation" editable={!busy} onChange={value => change('occupation', value)} />
              <Question label={t('settings.personalization.focusLabel')} hint={t('settings.personalization.focusHint')} value={draft.currentFocus} field="currentFocus" editable={!busy} onChange={value => change('currentFocus', value)} />
              <Question label={t('settings.personalization.preferencesLabel')} hint={t('settings.personalization.preferencesHint')} value={draft.preferences} field="preferences" editable={!busy} onChange={value => change('preferences', value)} />
              <View className="rounded-xl border border-border bg-card p-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <Text className="flex-1 text-fg font-semibold">{t('settings.personalization.useProfile')}</Text>
                  <Switch value={draft.enabled} onValueChange={value => change('enabled', value)} disabled={busy} accessibilityLabel={t('settings.personalization.useProfile')} trackColor={{ true: colors.accent, false: colors.border }} />
                </View>
                <Text className="text-muted text-sm leading-5">{t('settings.personalization.useProfileHint')}</Text>
              </View>
              <Text className="text-muted text-sm leading-5">{t('settings.personalization.syncNote')}</Text>
              {profile.mutationError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-danger">{tKey(personalizationErrorKey(profile.mutationError))}</Text>{conflict ? <Button title={t('settings.personalization.reloadSaved')} variant="secondary" loading={reloading} disabled={profile.pending} onPress={confirmReload} /> : null}</View> : null}
              {messageKey ? <Text accessibilityLiveRegion="polite" className="text-fg">{tKey(messageKey)}</Text> : null}
              <Button title={t('settings.personalization.save')} loading={profile.pending} disabled={busy || !!conflict || !dirty || (draft.enabled && !hasPersonalization(draft))} onPress={() => { void save(); }} />
              {draft.enabled && !hasPersonalization(draft) ? <Text className="text-muted text-sm">{t('settings.personalization.needsAnswer')}</Text> : null}
              {profile.data && hasPersonalization(profile.data) ? <Button title={t('settings.personalization.clear')} variant="danger" disabled={busy || !!conflict} onPress={clear} /> : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Question({ label, hint, value, field, editable, onChange }: { label: string; hint: string; value: string; field: keyof typeof PERSONALIZATION_LIMITS; editable: boolean; onChange: (value: string) => void }) {
  const colors = useResolvedColors();
  const { t, formatNumber } = useI18n();
  const limit = PERSONALIZATION_LIMITS[field];
  return <View className="gap-2">
    <Text className="text-fg font-semibold">{label}</Text>
    <Text className="text-muted text-sm">{hint}</Text>
    <TextInput accessibilityLabel={label} accessibilityHint={t('settings.personalization.fieldHint', { hint, limit })} value={value} onChangeText={onChange} maxLength={limit} multiline editable={editable} textAlignVertical="top" className="rounded-xl border border-border bg-card p-3 text-fg" style={{ minHeight: 108, fontSize: 16, lineHeight: 23 }} selectionColor={colors.accent} />
    <Text accessibilityLabel={t('common.a11y.charactersUsed', { used: value.length, limit })} className="text-muted text-xs text-right">{formatNumber(value.length)}/{formatNumber(limit)}</Text>
  </View>;
}
