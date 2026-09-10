import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType } from '@/types';

import { ChatMessage } from './ChatMessage';
import { Spinner } from '@/components/ui/Spinner';

type Props = {
  messages: ChatMessageType[];
  ready: boolean;
  onRetry: () => void;
  retryDisabled: boolean;
  /**
   * Called when a user taps a suggested prompt in the welcome state. Wired by
   * ChatScreen to useChat().send. Optional — the welcome state still renders
   * without it (prompts just won't auto-send).
   */
  onPromptTap?: (text: string) => void;
};

const EXAMPLE_PROMPTS = [
  'Help me rediscover something I saved recently',
  'What topics appear in my saved content?',
  'Summarize my most recent saves',
] as const;

export const ChatWindow: React.FC<Props> = ({ messages, onPromptTap, ready, onRetry, retryDisabled }) => {
  const colors = useResolvedColors();
  const ref = useRef<FlatList<ChatMessageType>>(null);
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const latestUserId = [...messages].reverse().find(message => message.role === 'user')?.id;
  useEffect(() => { following.current = true; setShowLatest(false); }, [latestUserId]);
  const follow = () => { if (following.current) ref.current?.scrollToEnd({ animated: false }); else setShowLatest(true); };
  if (!ready) return <View className="flex-1 items-center justify-center"><Spinner /><Text className="text-muted pt-3">Loading conversations…</Text></View>;
  if (messages.length === 0) return <WelcomeState onPromptTap={onPromptTap} />;
  return (
    <View className="flex-1">
      <FlatList ref={ref} data={messages} keyExtractor={m => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onLayout={follow}
        onScrollBeginDrag={() => { following.current = false; }}
        onScroll={event => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const nearEnd = contentSize.height - contentOffset.y - layoutMeasurement.height < 72;
          following.current = nearEnd;
          setShowLatest(!nearEnd);
        }} scrollEventThrottle={100}
        onContentSizeChange={follow}
        renderItem={({ item, index }) => <ChatMessage message={item} onRetry={index === messages.length - 1 ? onRetry : undefined} retryDisabled={retryDisabled} />}
        contentContainerStyle={{ paddingVertical: 8 }} />
      {showLatest ? <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center', backgroundColor: 'transparent' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go to latest" onPress={() => { following.current = true; setShowLatest(false); ref.current?.scrollToEnd({ animated: false }); }}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.surface : colors.card, borderWidth: 1, borderColor: colors.border, shadowColor: colors.fg, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 })}>
          <Feather name="arrow-down" size={20} color={colors.fg} accessible={false} />
        </Pressable>
      </View> : null}
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
