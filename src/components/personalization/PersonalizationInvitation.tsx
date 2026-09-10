import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { usePersonalization } from '@/hooks/usePersonalization';
import { useAuth } from '@/lib/auth';
import { personalizationDraft, personalizationError, shouldInvitePersonalization } from '@/lib/personalization';

const bannerInk = '#1C1815';

/** Full-width top notice shared by Inbox and Chat; dismissal belongs to the account. */
export function PersonalizationInvitation() {
  const { user } = useAuth();
  const profile = usePersonalization(user?.id);
  if (!profile.data || !shouldInvitePersonalization(profile.data)) return null;
  const conflict = profile.mutationError?.status === 409 || profile.mutationError?.code === 'PERSONALIZATION_CONFLICT';
  return <View style={{ backgroundColor: '#F97316', paddingHorizontal: 16, paddingVertical: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '600' }}>Get answers that fit you</Text>
        <Text style={{ color: bannerInk, fontSize: 13, lineHeight: 18, marginTop: 2 }}>Three short questions about your work and goals.</Text>
      </View>
      <Pressable disabled={profile.pending} accessibilityRole="button" accessibilityLabel="Dismiss interview reminder for now" accessibilityState={{ disabled: profile.pending, busy: profile.pending }} onPress={() => {
        if (profile.data) void profile.save({ ...personalizationDraft(profile.data), onboardingDismissed: true });
      }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        {profile.pending ? <ActivityIndicator color={bannerInk} /> : <Feather name="x" size={20} color={bannerInk} />}
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      <Pressable accessibilityRole="button" onPress={() => router.push('/personalization')} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}>Complete interview</Text>
      </Pressable>
      {conflict ? <Pressable accessibilityRole="button" onPress={() => { profile.resetMutationError(); void profile.refetch(); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: bannerInk, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>Reload profile</Text>
      </Pressable> : null}
    </View>
    {profile.mutationError ? <Text accessibilityRole="alert" style={{ color: bannerInk, fontSize: 13, lineHeight: 18, paddingBottom: 4 }}>{conflict ? 'Your profile changed. Reload it to continue.' : personalizationError(profile.mutationError)}</Text> : null}
  </View>;
}
