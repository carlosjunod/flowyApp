import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState, useId, useRef, useCallback } from 'react';
import { Alert, BackHandler, Keyboard, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TouchableWithoutFeedback, View } from 'react-native';
import { ChatHistoryDrawer } from './ChatHistoryDrawer';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/hooks/useChat';
import { useResolvedColors } from '@/lib/theme';

export function ChatPanel({ focused, actions, onShowSources, compact = false }: { compact?: boolean; focused: boolean; actions?: React.ReactNode; onShowSources?: (ids: string[]) => void }) {
  const chat = useChat();
  const colors = useResolvedColors();
  const [historyOpen, setHistoryOpen] = useState(false);
  const visibilityId = useId();
  const keyboardParent = useRef<View>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const measureKeyboardParent = useCallback(() => {
    // KeyboardAvoidingView uses parent-relative layout, but keyboard frames are
    // screen-relative. Include safe areas and the floating panel's origin.
    keyboardParent.current?.measureInWindow((_x, y) => setKeyboardOffset(y));
  }, []);
  useEffect(() => {
    if (!focused || historyOpen) return;
    const frame = requestAnimationFrame(measureKeyboardParent);
    return () => cancelAnimationFrame(frame);
  }, [focused, historyOpen, measureKeyboardParent]);
  useEffect(() => { chat.setVisible(focused, visibilityId); return () => chat.setVisible(false, visibilityId); }, [focused, visibilityId]);
  useEffect(() => {
    if (!focused || !historyOpen) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setHistoryOpen(false); return true; });
    return () => listener.remove();
  }, [focused, historyOpen]);
  useEffect(() => { if (!focused) setHistoryOpen(false); }, [focused]);
  return (
    <View className="flex-1 bg-bg">
      <View ref={keyboardParent} collapsable={false} onLayout={measureKeyboardParent} style={{ flex: 1, display: compact && historyOpen ? 'none' : 'flex' }}>
      <View className="flex-row items-center gap-2 px-3 py-2 border-b border-border">
        <Pressable onPress={() => { Keyboard.dismiss(); setHistoryOpen(true); }} accessibilityRole="button" accessibilityLabel="Chat history" className="w-11 h-11 justify-center items-center">
          <Feather name="sidebar" size={20} color={colors.fg} />
        </Pressable>
        <Text className="flex-1 text-fg font-semibold" numberOfLines={1}>{chat.active.messages.length ? chat.active.title : 'Chat'}</Text>
        <Pressable onPress={chat.reset} disabled={!chat.ready} accessibilityRole="button" accessibilityLabel="New chat" className="w-11 h-11 justify-center items-center">
          <Feather name="edit" size={20} color={colors.fg} />
        </Pressable>
        {actions}
      </View>
      {chat.storageError ? <View className="px-4 py-2"><Text accessibilityRole="alert" className="text-danger text-sm">{chat.storageError}</Text><Button title={chat.ready ? 'Retry saving' : 'Retry loading'} variant="ghost" onPress={chat.retryStorage} /></View> : null}
      {chat.generatingId && !chat.pending ? <View className="px-4 py-2 flex-row items-center"><Pressable className="flex-1 py-2" onPress={() => chat.select(chat.generatingId!)}><Text className="text-muted text-sm">A response is being prepared in another chat. View</Text></Pressable><Button title="Stop" variant="ghost" onPress={chat.stop} /></View> : null}
      {chat.active.before ? <Button title="Load earlier messages" variant="ghost" onPress={() => void chat.loadOlder()} /> : null}
      <KeyboardAvoidingView enabled={focused} keyboardVerticalOffset={keyboardOffset} style={{ flex: 1, minHeight: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1, minHeight: 0 }}>
            <ChatWindow compact={compact} onShowSources={onShowSources} key={chat.active.id} messages={chat.messages} ready={chat.ready} onPromptTap={chat.send} onRetry={chat.retry} retryDisabled={!!chat.generatingId} />
          </View>
        </TouchableWithoutFeedback>
        <ChatInput value={chat.draft} onChange={chat.setDraft} onSend={chat.send} preparing={chat.pending && chat.messages.at(-1)?.historyStatus === 'preparing'} pending={chat.pending} disabled={!chat.ready || !!chat.generatingId} onStop={chat.stop} />
      </KeyboardAvoidingView>
      </View>
      <HistorySurface compact={compact} open={historyOpen && focused} onClose={() => setHistoryOpen(false)}>
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
              <Pressable className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel={`Delete conversation ${item.title}`} onPress={() => Alert.alert('Delete conversation?', 'This deletes it from all your devices.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => chat.deleteConversation(item.id) }])}><Feather name="trash-2" size={16} color={colors.muted} /></Pressable>
            </View>
          )} />
          <Text className="px-6 py-4 text-xs text-muted">{chat.synced ? 'Chats saved to your account. Drafts stay on this device.' : 'Local copy available. Connect to sync your chats.'}</Text>
      </HistorySurface>
    </View>
  );
}

function HistorySurface({ compact, open, onClose, children }: { compact: boolean; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!compact) return <ChatHistoryDrawer open={open} onClose={onClose}>{children}</ChatHistoryDrawer>;
  return open ? <View className="flex-1 bg-surface" onAccessibilityEscape={onClose}>{children}</View> : null;
}
