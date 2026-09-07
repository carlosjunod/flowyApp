import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
          <Feather name="clock" size={20} color={colors.fg} />
        </Pressable>
        <Text className="flex-1 text-fg font-semibold" numberOfLines={1}>{chat.active.messages.length ? chat.active.title : 'Chat'}</Text>
        <Pressable onPress={chat.reset} disabled={!chat.ready} accessibilityRole="button" accessibilityLabel="New conversation" className="w-11 h-11 justify-center items-center">
          <Feather name="edit" size={20} color={colors.fg} />
        </Pressable>
      </View>
      {chat.storageError ? <View className="px-4 py-2"><Text accessibilityRole="alert" className="text-danger text-sm">{chat.storageError}</Text><Button title={chat.ready ? 'Retry saving' : 'Retry loading'} variant="ghost" onPress={chat.retryStorage} /></View> : null}
      {chat.generatingId && !chat.pending ? <View className="px-4 py-2 flex-row items-center"><Pressable className="flex-1 py-2" onPress={() => chat.select(chat.generatingId!)}><Text className="text-muted text-sm">A response is being prepared in another chat. View</Text></Pressable><Button title="Stop" variant="ghost" onPress={chat.stop} /></View> : null}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ChatWindow key={chat.active.id} messages={chat.messages} ready={chat.ready} onPromptTap={chat.send} onRetry={chat.retry} retryDisabled={!!chat.generatingId} />
        <ChatInput value={chat.draft} onChange={chat.setDraft} onSend={chat.send} pending={chat.pending} disabled={!chat.ready || !!chat.generatingId} onStop={chat.stop} />
      </KeyboardAvoidingView>
      <Modal visible={historyOpen} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <SafeAreaView className="flex-1 bg-bg">
          <View className="px-4 flex-row items-center justify-between"><Text className="text-xl text-fg font-semibold">Conversations</Text><Button title="Done" variant="ghost" onPress={() => setHistoryOpen(false)} /></View>
          <Text className="px-4 py-2 text-sm text-muted">Saved on this device for your account.</Text>
          <FlatList data={[...chat.snapshot.conversations].sort((a, b) => b.updated - a.updated)} keyExtractor={c => c.id} renderItem={({ item }) => (
            <View className="flex-row items-center border-b border-border px-4">
              <Pressable className="flex-1 py-4" accessibilityRole="button" accessibilityState={{ selected: item.id === chat.active.id }} onPress={() => { chat.select(item.id); setHistoryOpen(false); }}>
                <Text className="text-fg font-medium" numberOfLines={2}>{item.title}</Text><Text className="text-xs text-muted pt-1">{item.id === chat.generatingId ? 'Preparing response…' : item.draft ? 'Draft' : new Date(item.updated).toLocaleDateString()}</Text>
              </Pressable>
              <Pressable className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel={`Delete conversation ${item.title}`} onPress={() => Alert.alert('Delete conversation?', 'This removes it from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => chat.deleteConversation(item.id) }])}><Feather name="trash-2" size={18} color={colors.muted} /></Pressable>
            </View>
          )} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
