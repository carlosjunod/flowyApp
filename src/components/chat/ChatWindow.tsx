import React, { useEffect, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';

import type { ChatMessage as ChatMessageType } from '@/types';

import { ChatMessage } from './ChatMessage';

type Props = {
  messages: ChatMessageType[];
};

export const ChatWindow: React.FC<Props> = ({ messages }) => {
  const ref = useRef<FlatList<ChatMessageType>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      ref.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-5xl mb-3">💬</Text>
        <Text className="text-base text-muted text-center">
          Ask about anything in your inbox. Claude will cite the items it used.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={ref}
      data={messages}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <ChatMessage message={item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
    />
  );
};
