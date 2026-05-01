import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatInput } from '@/components/chat/ChatInput';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChat } from '@/hooks/useChat';

export default function ChatScreen() {
  const { messages, pending, error, send, reset } = useChat();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text
          className="text-2xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.3 }}
        >
          Chat
        </Text>
        <Pressable onPress={reset} hitSlop={8}>
          <Text className="text-accent font-medium">New chat</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View className="flex-1">
          <ChatWindow messages={messages} />
          {error ? (
            <Text className="text-danger text-sm px-4 pb-1">{error}</Text>
          ) : null}
        </View>
        <ChatInput disabled={pending} onSend={send} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
