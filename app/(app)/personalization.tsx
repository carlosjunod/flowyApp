import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { usePersonalization } from '@/hooks/usePersonalization';
import { useAuth } from '@/lib/auth';
import { hasPersonalization, initialPersonalizationDraft, normalizePersonalization, PERSONALIZATION_LIMITS, personalizationDraft, personalizationError } from '@/lib/personalization';
import { useResolvedColors } from '@/lib/theme';
import type { PersonalizationInput } from '@/types';

export default function PersonalizationScreen() {
  const { user } = useAuth();
  return user ? <PersonalizationForm key={user.id} accountId={user.id} /> : null;
}

function PersonalizationForm({ accountId }: { accountId: string }) {
  const profile = usePersonalization(accountId);
  const colors = useResolvedColors();
  const [draft, setDraft] = useState<PersonalizationInput | null>(null);
  const [message, setMessage] = useState('');
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
    setMessage('');
    setDraft(previous => previous ? { ...previous, [key]: value } : previous);
  }
  async function save() {
    if (!draft) return;
    setMessage('');
    const saved = await profile.save({ ...normalizePersonalization(draft), onboardingDismissed: true });
    if (saved) {
      setDraft(personalizationDraft(saved));
      setMessage(saved.enabled ? 'Profile saved. Flowy will use it for your next chat responses.' : 'Profile saved. Personalization is off.');
    }
  }
  async function reload() {
    setReloading(true);
    setMessage('');
    const result = await profile.refetch();
    setReloading(false);
    if (result.isSuccess && result.data) {
      setDraft(personalizationDraft(result.data));
      profile.resetMutationError();
      setMessage('Loaded your saved profile.');
    } else setMessage('Could not reload your profile. Your edits are still here. Try again.');
  }
  function confirmReload() {
    Alert.alert('Reload saved profile?', 'This replaces the edits on this screen with your latest saved profile.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Reload', onPress: () => { void reload(); } },
    ]);
  }
  function clear() {
    if (!draft) return;
    const revision = draft.revision;
    Alert.alert('Clear your profile?', 'This deletes your saved answers and turns off personalization. Existing chat messages stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear profile', style: 'destructive', onPress: async () => {
        setMessage('');
        const saved = await profile.clear(revision);
        if (saved) {
          setDraft(personalizationDraft(saved));
          setMessage('Profile cleared. Personalization is off.');
        }
      } },
    ]);
  }
  function goBack() {
    if (!dirty) { router.back(); return; }
    Alert.alert('Leave without saving?', 'Your changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Leave', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 flex-row items-center border-b border-border">
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" className="min-h-11 flex-row items-center gap-1 pr-4">
          <Feather name="chevron-left" size={20} color={colors.fg} /><Text className="text-fg">Back</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 24, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-fg" style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 34 }}>What Flowy knows about you</Text>
            <Text className="text-muted leading-6">Share a little context so answers fit your work and goals. All questions are optional. You can update or clear your profile anytime.</Text>
          </View>
          {!draft ? profile.isFetching ? <View className="flex-row items-center gap-3"><Spinner /><Text className="text-muted">Loading your profile…</Text></View> : (
            <View className="gap-3"><Text accessibilityRole="alert" className="text-danger">Could not load your profile. Check your connection and try again.</Text><Button title="Retry loading" variant="secondary" onPress={() => { void profile.refetch(); }} /></View>
          ) : (
            <>
              <Question label="What do you do or what are you learning?" hint="Your role, experience, or areas you are learning." value={draft.occupation} field="occupation" editable={!busy} onChange={value => change('occupation', value)} />
              <Question label="What are you working on now?" hint="A current project, goal, or challenge." value={draft.currentFocus} field="currentFocus" editable={!busy} onChange={value => change('currentFocus', value)} />
              <Question label="What should Flowy consider when recommending something?" hint="Tools you use, preferences, time, or budget." value={draft.preferences} field="preferences" editable={!busy} onChange={value => change('preferences', value)} />
              <View className="rounded-xl border border-border bg-card p-4 gap-3">
                <View className="flex-row items-center gap-3">
                  <Text className="flex-1 text-fg font-semibold">Use this profile in chat</Text>
                  <Switch value={draft.enabled} onValueChange={value => change('enabled', value)} disabled={busy} accessibilityLabel="Use this profile in chat" trackColor={{ true: colors.accent, false: colors.border }} />
                </View>
                <Text className="text-muted text-sm leading-5">When enabled, your saved answers are shared with Flowy's AI provider to personalize future chat responses. Turning this off keeps your answers for later. Tap Save profile to apply changes.</Text>
              </View>
              <Text className="text-muted text-sm leading-5">This profile syncs across your web and mobile apps. Flowy only remembers the answers you save here; it does not automatically add memories from conversations.</Text>
              {profile.mutationError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-danger">{personalizationError(profile.mutationError)}</Text>{conflict ? <Button title="Reload saved profile" variant="secondary" loading={reloading} disabled={profile.pending} onPress={confirmReload} /> : null}</View> : null}
              {message ? <Text accessibilityLiveRegion="polite" className="text-fg">{message}</Text> : null}
              <Button title="Save profile" loading={profile.pending} disabled={busy || !!conflict || !dirty || (draft.enabled && !hasPersonalization(draft))} onPress={() => { void save(); }} />
              {draft.enabled && !hasPersonalization(draft) ? <Text className="text-muted text-sm">Add at least one answer to enable personalization.</Text> : null}
              {profile.data && hasPersonalization(profile.data) ? <Button title="Clear profile" variant="danger" disabled={busy || !!conflict} onPress={clear} /> : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Question({ label, hint, value, field, editable, onChange }: { label: string; hint: string; value: string; field: keyof typeof PERSONALIZATION_LIMITS; editable: boolean; onChange: (value: string) => void }) {
  const colors = useResolvedColors();
  const limit = PERSONALIZATION_LIMITS[field];
  return <View className="gap-2">
    <Text className="text-fg font-semibold">{label}</Text>
    <Text className="text-muted text-sm">{hint}</Text>
    <TextInput accessibilityLabel={label} accessibilityHint={`${hint} Maximum ${limit} characters.`} value={value} onChangeText={onChange} maxLength={limit} multiline editable={editable} textAlignVertical="top" className="rounded-xl border border-border bg-card p-3 text-fg" style={{ minHeight: 108, fontSize: 16, lineHeight: 23 }} selectionColor={colors.accent} />
    <Text className="text-muted text-xs text-right">{value.length}/{limit}</Text>
  </View>;
}
