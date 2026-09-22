import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useInstagramConnection } from '@/hooks/useInstagramConnection';
import { instagramHandle } from '@/lib/instagramConnection';
import type { InstagramDestination } from '@/types/instagram';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

export default function InstagramScreen() {
  const { user } = useAuth();
  return <InstagramConnectionScreen key={user?.id ?? 'signed-out'} accountId={user?.id} />;
}

export function InstagramConnectionScreen({ accountId }: { accountId?: string }) {
  const [destination, setDestination] = useState<string>();
  const [accounts, setAccounts] = useState<InstagramDestination[]>([]);
  return <InstagramDestinationScreen key={destination || 'default'} accountId={accountId} destination={destination}
    accounts={accounts} onAccounts={setAccounts} onDestination={setDestination} />;
}
function InstagramDestinationScreen({ accountId, destination, accounts, onAccounts, onDestination }: {
  accountId?: string; destination?: string; accounts: InstagramDestination[];
  onAccounts: (accounts: InstagramDestination[]) => void; onDestination: (destination: string) => void;
}) {
  const colors = useResolvedColors();
  const { t, tKey, formatTime } = useI18n();
  const state = useInstagramConnection(accountId, destination);
  React.useEffect(() => { if (state.data?.accounts) onAccounts(state.data.accounts); }, [state.data?.accounts, onAccounts]);
  const handle = instagramHandle(state.data);
  const [manual, setManual] = useState(false);
  const showCode = state.connection && !state.expired;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('settings.instagram.backLabel')} hitSlop={8} className="flex-row items-center gap-1.5">
          <Feather name="chevron-left" size={20} color={colors.fg} />
          <Text className="text-fg text-sm">{t('settings.instagram.back')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>
        <View className="gap-2">
          <Feather name="instagram" size={28} color={colors.accent} />
          <Text className="text-fg text-3xl" style={{ fontFamily: 'InstrumentSerif_400Regular' }}>{t('settings.instagram.title')}</Text>
          <Text className="text-muted text-sm leading-5">{t('settings.instagram.intro', { handle })}</Text>
          <Text className="text-muted text-xs leading-5">{t('settings.instagram.introMention', { handle })}</Text>
        </View>
        {accounts.length > 1 && <View className="gap-2">
          <Text className="text-fg text-sm font-semibold">{t('settings.instagram.accountGroup')}</Text>
          {accounts.map(a => <Pressable key={a.id} accessibilityRole="radio"
            accessibilityState={{ checked: (destination || state.data?.account || accounts[0]?.id) === a.id }}
            onPress={() => onDestination(a.id)} className="rounded-xl border border-border bg-card p-3">
            <Text className="text-fg">{(destination || state.data?.account || accounts[0]?.id) === a.id ? '● ' : '○ '}@{a.handle}</Text>
            <Text className="text-muted text-xs">{a.language === 'es' ? t('settings.instagram.languageEs') : t('settings.instagram.languageEn')}</Text>
          </Pressable>)}
          <Text className="text-muted text-xs">{t('settings.instagram.accountsHint')}</Text>
        </View>}
        {state.errorKey && <View className="rounded-xl border border-danger p-4 gap-3">
          <Text accessibilityRole="alert" className="text-danger">{tKey(state.errorKey, { handle })}</Text>
          <Button title={t('settings.instagram.refresh')} variant="secondary" onPress={state.refresh} />
        </View>}
        {state.isLoading && <View className="flex-row items-center gap-2"><Spinner /><Text className="text-muted">{t('settings.instagram.loading')}</Text></View>}
        {state.data?.connected ? <View className="rounded-xl border border-border bg-card p-4 gap-4">
          <Text accessibilityLiveRegion="polite" className="text-fg font-semibold">{t('settings.instagram.connected')}</Text>
          {state.data.username ? <Text className="text-muted text-sm">{t('settings.instagram.connectedAs', { username: state.data.username })}</Text> : null}
          <Text className="text-muted text-sm leading-5">{t('settings.instagram.connectedBody', { handle })}</Text>
          <Button title={t('settings.instagram.openInstagram')} onPress={() => void state.openChat()} />
          <Text className="text-muted text-xs leading-5">{t('settings.instagram.disconnectHint')}</Text>
          <Button title={t('settings.instagram.disconnect')} variant="secondary" loading={state.pending} onPress={() => void state.disconnect()} />
        </View> : state.data?.enabled ? <View className="rounded-xl border border-border bg-card p-4 gap-4">
          <Text className="text-fg text-sm leading-5">{state.data.referralEnabled
            ? t('settings.instagram.referralSteps')
            : t('settings.instagram.codeSteps', { handle })}</Text>
          <Text className="text-muted text-xs leading-5">{t('settings.instagram.privacy')}</Text>
          {state.expired && <Text accessibilityLiveRegion="polite" className="text-muted">{t('settings.instagram.expired')}</Text>}
          <Button title={showCode && state.data.referralEnabled ? t('settings.instagram.openInstagram') : state.expired ? t('settings.instagram.regenerate') : t('settings.instagram.connect')} loading={state.pending} onPress={() => void state.connect()} />
          {showCode && <>
            <Text accessibilityLiveRegion="polite" className="text-muted text-sm">{state.handoffReturned
              ? t('settings.instagram.manualHint', { handle })
              : t('settings.instagram.waiting')}</Text>
            <Text className="text-muted text-xs">{t('settings.instagram.expiresAt', { time: formatTime(state.connection!.expiresAt!) })}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: manual || !state.data.referralEnabled || state.handoffReturned }} onPress={() => setManual(v => !v)} className="py-2">
              <Text className="text-accent text-sm">{t('settings.instagram.trouble')}</Text>
            </Pressable>
            {(manual || !state.data.referralEnabled || state.handoffReturned) && <View className="gap-3">
              <Text className="text-muted text-sm">{t('settings.instagram.sendCode', { handle })}</Text>
              <Text selectable className="text-fg text-sm">{state.connection!.code}</Text>
              <Button title={state.copied ? t('settings.instagram.copied') : t('settings.instagram.copyCode')} variant="secondary" onPress={() => void state.copyCode()} />
              <Button title={t('settings.instagram.openChat')} variant="ghost" onPress={() => void state.openChat()} />
            </View>}
            <Button title={t('settings.instagram.regenerate')} variant="ghost" disabled={state.pending} onPress={() => void state.connect(true)} />
          </>}
        </View> : state.data && <Text className="text-muted">{t('settings.instagram.preparing')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
