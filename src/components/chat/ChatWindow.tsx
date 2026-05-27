import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType } from '@/types';

import { ChatMessage } from './ChatMessage';
import { ConversationItemsStrip } from './ConversationItemsStrip';

type Props = {
  messages: ChatMessageType[];
  /**
   * Called when a user taps a suggested prompt in the welcome state. Wired by
   * ChatScreen to useChat().send. Optional — the welcome state still renders
   * without it (prompts just won't auto-send).
   */
  onPromptTap?: (text: string) => void;
};

const EXAMPLE_PROMPTS = [
  'What did I save about marketing last week?',
  'Show me my receipts over $50',
  'Summarize my recent YouTube videos',
] as const;

export const ChatWindow: React.FC<Props> = ({ messages, onPromptTap }) => {
  const ref = useRef<FlatList<ChatMessageType>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      ref.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  if (messages.length === 0) {
    return <WelcomeState onPromptTap={onPromptTap} />;
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

// ─────────────────────────────────────────────────────────────
// Welcome state — branded title + tappable example prompts
// ─────────────────────────────────────────────────────────────
const WelcomeState: React.FC<{ onPromptTap?: (text: string) => void }> = ({ onPromptTap }) => {
  const colors = useResolvedColors();
  return (
    <View className="flex-1 items-center justify-center px-6 gap-5">
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: colors.accent + '1A',
          borderWidth: 1,
          borderColor: colors.accent + '40',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="zap" size={28} color={colors.accent} />
      </View>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 32,
            lineHeight: 36,
            letterSpacing: -0.5,
            textAlign: 'center',
            color: colors.fg,
          }}
        >
          Ask anything about{'\n'}
          <Text style={{ color: colors.accent, fontStyle: 'italic' }}>
            your saved content
          </Text>
        </Text>
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 19,
            textAlign: 'center',
            color: colors.muted,
            maxWidth: 320,
          }}
        >
          Flowy searches across every article, screenshot, video, and receipt you've shared.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        {EXAMPLE_PROMPTS.map((ex) => (
          <Pressable
            key={ex}
            onPress={() => onPromptTap?.(ex)}
            disabled={!onPromptTap}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: 'Inter_500Medium',
                fontSize: 12,
                color: colors.fg,
              }}
            >
              {ex}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};
