import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import type { ChatMessage as ChatMessageType } from '@/types';

import { ChatMessage } from './ChatMessage';
import { ConversationItemsStrip } from './ConversationItemsStrip';

type Props = {
  messages: ChatMessageType[];
  onSuggestionPress?: (text: string) => void;
};

const SUGGESTIONS = [
  'Summarize what I saved this week',
  'What did I read about AI agents?',
  'Find articles about startups',
];

export const ChatWindow: React.FC<Props> = ({ messages, onSuggestionPress }) => {
  const ref = useRef<FlatList<ChatMessageType>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      ref.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <View className="flex-1 px-6 pt-8">
        <Text
          className="text-4xl text-fg mb-2"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Ask about{'\n'}
          <Text className="text-accent">your content</Text>
        </Text>
        <Text className="text-base text-muted mb-6">
          Search across every screenshot, video, and link you've shared.
        </Text>
        <View className="gap-2 items-start">
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => onSuggestionPress?.(s)}
              className="rounded-full border border-border bg-card px-4 py-2"
            >
              <Text className="text-fg text-sm">{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ConversationItemsStrip messages={messages} />
      <FlatList
        ref={ref}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
};
