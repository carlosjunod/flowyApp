import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatHistoryDrawer } from '@/components/chat/ChatHistoryDrawer';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/hooks/useChat';
import { useResolvedColors } from '@/lib/theme';

export default function ChatScreen() {
  const chat = useChat();
  const colors = useResolvedColors();
  const focused = useIsFocused();
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => { chat.setVisible(focused); return () => chat.setVisible(false); }, [focused]);
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 py-2 border-b border-border">
        <Pressable onPress={() => setHistoryOpen(true)} accessibilityRole="button" accessibilityLabel="Chat history" className="w-11 h-11 justify-center items-center">
          <Feather name="sidebar" size={20} color={colors.fg} />
        </Pressable>
        <Text className="flex-1 text-fg font-semibold" numberOfLines={1}>{chat.active.messages.length ? chat.active.title : 'Chat'}</Text>
        <Pressable onPress={chat.reset} disabled={!chat.ready} accessibilityRole="button" accessibilityLabel="New chat" className="w-11 h-11 justify-center items-center">
          <Feather name="edit" size={20} color={colors.fg} />
        </Pressable>
      </View>
      {chat.storageError ? <View className="px-4 py-2"><Text accessibilityRole="alert" className="text-danger text-sm">{chat.storageError}</Text><Button title={chat.ready ? 'Retry sync' : 'Retry loading'} variant="ghost" onPress={chat.retryStorage} /></View> : null}
      {chat.localOnly && !chat.storageError ? <View className="px-4 py-2"><Text className="text-muted text-sm">Chat sync is not available yet. New chats are saved on this device.</Text><Button title="Check sync" variant="ghost" onPress={chat.refresh} /></View> : null}
      {chat.generatingId && !chat.pending ? <View className="px-4 py-2 flex-row items-center"><Pressable className="flex-1 py-2" onPress={() => chat.select(chat.generatingId!)}><Text className="text-muted text-sm">A response is being prepared in another chat. View</Text></Pressable><Button title="Stop" variant="ghost" onPress={chat.stop} /></View> : null}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {chat.active.before ? <Button title="Load earlier messages" variant="ghost" onPress={chat.loadOlder} /> : null}
        {!chat.generatingId && chat.active.pending ? <Text className="px-4 py-2 text-muted text-sm">A response is being prepared on another device…</Text> : null}
        <ChatWindow key={chat.active.id} messages={chat.messages} ready={chat.ready} onPromptTap={chat.send} onRetry={chat.retry} retryDisabled={!!chat.generatingId} />
        <ChatInput value={chat.draft} onChange={chat.setDraft} onSend={chat.send} pending={chat.pending} preparing={chat.preparingId === chat.active.id} disabled={!chat.ready || !!chat.generatingId} onStop={chat.stop} />
      </KeyboardAvoidingView>
      <ChatHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)}>
          <View className="px-3 py-2 flex-row items-center justify-between">
            <Text style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 28, color: colors.fg }} className="px-2">Flowy<Text style={{ color: colors.accent }}>.</Text></Text>
            <Pressable className="w-11 h-11 items-center justify-center rounded-xl" accessibilityRole="button" accessibilityLabel="Close chat history" onPress={() => setHistoryOpen(false)}><Feather name="sidebar" size={21} color={colors.fg} /></Pressable>
          </View>
          <Pressable disabled={!chat.ready} accessibilityRole="button" className="mx-3 mb-6 px-3 py-3 flex-row items-center gap-3 rounded-xl" onPress={() => { chat.reset(); setHistoryOpen(false); }}>
            <Feather name="edit" size={20} color={colors.fg} /><Text className="text-fg font-medium">New chat</Text>
          </Pressable>
          <Text accessibilityRole="header" className="px-6 pb-2 text-xs text-muted font-medium">Chats</Text>
          <FlatList className="flex-1" contentContainerStyle={{ paddingHorizontal: 12 }} data={chat.snapshot.conversations.filter(c => c.messages.length || c.messageCount || c.draft).sort((a, b) => b.updated - a.updated)} keyExtractor={c => c.id}
            ListEmptyComponent={<Text className="px-3 py-4 text-sm text-muted">Your conversations will appear here.</Text>}
            renderItem={({ item }) => (
            <View className="flex-row items-center rounded-xl mb-1 pl-3" style={{ backgroundColor: item.id === chat.active.id ? colors.bg : 'transparent' }}>
              <Pressable className="flex-1 py-3" accessibilityRole="button" accessibilityState={{ selected: item.id === chat.active.id }} onPress={() => { chat.select(item.id); setHistoryOpen(false); }}>
                <Text className="text-fg text-sm" numberOfLines={1}>{item.title}</Text>
                {item.id === chat.generatingId ? <Text className="text-xs text-muted pt-1">Preparing response…</Text> : item.draft ? <Text className="text-xs text-muted pt-1">Draft</Text> : null}
              </Pressable>
              <Pressable className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel={`Delete conversation ${item.title}`} onPress={() => Alert.alert('Delete conversation?', 'This removes it from all your devices.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => chat.deleteConversation(item.id) }])}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable>
            </View>
          )} />
          <Text className="px-6 py-4 text-xs text-muted">{chat.syncing ? 'Syncing chats…' : chat.synced ? 'Chats saved to your account. Drafts stay on this device.' : 'Local copy available. Connect to sync your chats.'}</Text>
      </ChatHistoryDrawer>
    </SafeAreaView>
  );
}
