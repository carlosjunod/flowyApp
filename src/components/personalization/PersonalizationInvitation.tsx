import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { usePersonalization } from '@/hooks/usePersonalization';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { personalizationDraft, personalizationErrorKey, shouldInvitePersonalization } from '@/lib/personalization';

const bannerInk = '#1C1815';

/** Full-width top notice shared by Inbox and Chat; dismissal belongs to the account. */
export function PersonalizationInvitation() {
  const { user } = useAuth();
  const { t, tKey } = useI18n();
  const profile = usePersonalization(user?.id);
  if (!profile.data || !shouldInvitePersonalization(profile.data)) return null;
  const conflict = profile.mutationError?.status === 409 || profile.mutationError?.code === 'PERSONALIZATION_CONFLICT';
  return <View style={{ backgroundColor: '#F97316', paddingHorizontal: 16, paddingVertical: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '600' }}>{t('settings.personalization.banner.strong')}</Text>
        <Text style={{ color: bannerInk, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{t('settings.personalization.banner.body')}</Text>
      </View>
      <Pressable disabled={profile.pending} accessibilityRole="button" accessibilityLabel={t('settings.personalization.banner.dismiss')} accessibilityState={{ disabled: profile.pending, busy: profile.pending }} onPress={() => {
        if (profile.data) void profile.save({ ...personalizationDraft(profile.data), onboardingDismissed: true });
      }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        {profile.pending ? <ActivityIndicator color={bannerInk} /> : <Feather name="x" size={20} color={bannerInk} />}
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/personalization')} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}>{t('settings.personalization.banner.complete')}</Text>
      </Pressable>
      {conflict ? <Pressable accessibilityRole="button" onPress={() => { profile.resetMutationError(); void profile.refetch(); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>{t('settings.personalization.banner.reload')}</Text>
      </Pressable> : null}
    </View>
    {profile.mutationError ? <Text accessibilityRole="alert" style={{ color: bannerInk, fontSize: 13, lineHeight: 18, paddingBottom: 4 }}>{conflict ? t('settings.personalization.banner.conflict') : tKey(personalizationErrorKey(profile.mutationError))}</Text> : null}
  </View>;
}
