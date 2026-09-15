import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Keyboard, Pressable, Text, View } from 'react-native';
import { useResolvedColors, useTheme } from '@/lib/theme';
import { useChat } from '@/hooks/useChat';
import { ChatPanel } from './ChatPanel';

export function InboxFloatingChat({ open, onOpenChange, onShowSources }: {
  open: boolean; onOpenChange: (open: boolean) => void; onShowSources: (ids: string[]) => void;
}) {
  const colors = useResolvedColors();
  const { resolved } = useTheme();
  const chat = useChat();
  const launcher = useRef<View>(null);
  const closeButton = useRef<View>(null);
  const wasOpen = useRef(false);
  const close = () => { Keyboard.dismiss(); onOpenChange(false); };
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { Keyboard.dismiss(); onOpenChange(false); return true; });
    return () => subscription.remove();
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open && !wasOpen.current) return;
    wasOpen.current = open;
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(open ? closeButton.current : launcher.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const action = { width: 44, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (!open) return <Pressable ref={launcher} onPress={() => onOpenChange(true)} accessibilityRole="button" accessibilityLabel={chat.unread ? 'Ask Flowy, response ready' : 'Ask Flowy'} accessibilityState={{ expanded: false }}
    style={{ position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.chatSend, alignItems: 'center', justifyContent: 'center', shadowColor: colors.fg, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 4 }}>
    <View accessible={false} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
      <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 32, color: resolved === 'light' ? '#fff' : colors.onChatSend }}>f</Text>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: resolved === 'light' ? '#000' : '#fff' }} />
    </View>
    {chat.generatingId || chat.unread ? <View accessible={false} style={{ position: 'absolute', right: 0, top: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.fg, borderWidth: 2, borderColor: colors.bg }} /> : null}
  </Pressable>;
  return <View pointerEvents="box-none" style={{ position: 'absolute', top: 8, right: 8, bottom: 8, left: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
    <View accessibilityViewIsModal accessibilityLabel="Flowy chat" onAccessibilityEscape={close}
      style={{ width: '100%', maxWidth: 416, height: '100%', maxHeight: 640, overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
      <ChatPanel compact focused onShowSources={ids => { close(); onShowSources(ids); }} actions={<>
        <Pressable accessibilityRole="button" accessibilityLabel="Open full chat" style={action} onPress={() => { close(); router.navigate('/chat'); }}><Feather name="arrow-up-right" color={colors.fg} size={20} /></Pressable>
        <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel="Minimize chat" style={action} onPress={close}><Feather name="minus" color={colors.fg} size={20} /></Pressable>
      </>} />
    </View>
  </View>;
}
