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
  const state = useInstagramConnection(accountId, destination);
  React.useEffect(() => { if (state.data?.accounts) onAccounts(state.data.accounts); }, [state.data?.accounts, onAccounts]);
  const handle = instagramHandle(state.data);
  const [manual, setManual] = useState(false);
  const showCode = state.connection && !state.expired;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 py-3">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to Settings" hitSlop={8} className="flex-row items-center gap-1.5">
          <Feather name="chevron-left" size={20} color={colors.fg} />
          <Text className="text-fg text-sm">Settings</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }}>
        <View className="gap-2">
          <Feather name="instagram" size={28} color={colors.accent} />
          <Text className="text-fg text-3xl" style={{ fontFamily: 'InstrumentSerif_400Regular' }}>Save from Instagram</Text>
          <Text className="text-muted text-sm leading-5">Connect your Instagram account, then send public Instagram or TikTok post links to @{handle}. Flowy saves and processes them with AI in your library.</Text>
          <Text className="text-muted text-xs leading-5">After connecting, you can also mention @{handle} in a public post’s comments. For shared posts or reels, you may need to copy and send the public link.</Text>
        </View>
        {accounts.length > 1 && <View className="gap-2">
          <Text className="text-fg text-sm font-semibold">Instagram account</Text>
          {accounts.map(a => <Pressable key={a.id} accessibilityRole="radio"
            accessibilityState={{ checked: (destination || state.data?.account || accounts[0]?.id) === a.id }}
            onPress={() => onDestination(a.id)} className="rounded-xl border border-border bg-card p-3">
            <Text className="text-fg">{(destination || state.data?.account || accounts[0]?.id) === a.id ? '● ' : '○ '}@{a.handle}</Text>
            <Text className="text-muted text-xs">{a.language === 'es' ? 'Español' : 'English'}</Text>
          </Pressable>)}
          <Text className="text-muted text-xs">Connect each account separately. Both save to this library.</Text>
        </View>}
        {state.error && <View className="rounded-xl border border-danger p-4 gap-3">
          <Text accessibilityRole="alert" className="text-danger">{state.error}</Text>
          <Button title="Refresh status" variant="secondary" onPress={state.refresh} />
        </View>}
        {state.isLoading && <View className="flex-row items-center gap-2"><Spinner /><Text className="text-muted">Loading connection…</Text></View>}
        {state.data?.connected ? <View className="rounded-xl border border-border bg-card p-4 gap-4">
          <Text accessibilityLiveRegion="polite" className="text-fg font-semibold">Instagram connected</Text>
          {state.data.username ? <Text className="text-muted text-sm">Connected as @{state.data.username}</Text> : null}
          <Text className="text-muted text-sm leading-5">Send your next post link to @{handle}.</Text>
          <Button title="Open Instagram" onPress={() => void state.openChat()} />
          <Text className="text-muted text-xs leading-5">Disconnecting stops future saves. Posts already in your library stay there.</Text>
          <Button title="Disconnect Instagram" variant="secondary" loading={state.pending} onPress={() => void state.disconnect()} />
        </View> : state.data?.enabled ? <View className="rounded-xl border border-border bg-card p-4 gap-4">
          <Text className="text-fg text-sm leading-5">{state.data.referralEnabled
            ? 'Open Instagram with the account you want to connect. If prompted, tap the connection button in the chat or send a message. Then return to Flowy.'
            : `Generate a private code and send it to @${handle} from the Instagram account you want to connect.`}</Text>
          <Text className="text-muted text-xs leading-5">This connects that Instagram account to your current Flowy library. Keep connection links and codes private. They expire after 10 minutes.</Text>
          {state.expired && <Text accessibilityLiveRegion="polite" className="text-muted">Your connection link expired. Generate a new one to continue.</Text>}
          <Button title={showCode && state.data.referralEnabled ? 'Open Instagram' : state.expired ? 'Generate a new connection' : 'Connect Instagram'} loading={state.pending} onPress={() => void state.connect()} />
          {showCode && <>
            <Text accessibilityLiveRegion="polite" className="text-muted text-sm">{state.handoffReturned
              ? `Instagram may have asked you for a code. Send the code below to @${handle} as a message, then return here.`
              : 'Waiting for your connection. Flowy checks again when you return.'}</Text>
            <Text className="text-muted text-xs">Expires at {new Date(state.connection!.expiresAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: manual || !state.data.referralEnabled || state.handoffReturned }} onPress={() => setManual(v => !v)} className="py-2">
              <Text className="text-accent text-sm">Having trouble? Connect with a code</Text>
            </Pressable>
            {(manual || !state.data.referralEnabled || state.handoffReturned) && <View className="gap-3">
              <Text className="text-muted text-sm">Send this code to @{handle} as a message.</Text>
              <Text selectable className="text-fg text-sm">{state.connection!.code}</Text>
              <Button title={state.copied ? 'Copied' : 'Copy code'} variant="secondary" onPress={() => void state.copyCode()} />
              <Button title="Open chat" variant="ghost" onPress={() => void state.openChat()} />
            </View>}
            <Button title="Generate a new connection" variant="ghost" disabled={state.pending} onPress={() => void state.connect(true)} />
          </>}
        </View> : state.data && <Text className="text-muted">Instagram saving is being prepared. Please check back soon.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
