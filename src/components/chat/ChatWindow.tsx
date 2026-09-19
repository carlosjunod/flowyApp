import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, Pressable, Text, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType } from '@/types';

import { ChatMessage } from './ChatMessage';
import { Spinner } from '@/components/ui/Spinner';

type Props = {
  messages: ChatMessageType[];
  compact?: boolean;
  onShowSources?: (ids: string[]) => void;
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

/**
 * Suggestion chips are translated on purpose: tapping one *sends* it, so the
 * user is asking in their own language and gets an answer in it. This is the
 * same rule the web client applies — prefilled, user-reviewable text is
 * interface copy; stored messages are not.
 */
const EXAMPLE_PROMPT_KEYS = [
  'chat.empty.promptRediscover',
  'chat.empty.promptTopics',
  'chat.empty.promptSummarize',
] as const;

export const ChatWindow: React.FC<Props> = ({ messages, onPromptTap, ready, onRetry, retryDisabled, onShowSources, compact = false }) => {
  const { t } = useI18n();
  const colors = useResolvedColors();
  const prompts = EXAMPLE_PROMPT_KEYS.map((key) => t(key));
  const ref = useRef<FlatList<ChatMessageType>>(null);
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const latestUserId = [...messages].reverse().find(message => message.role === 'user')?.id;
  useEffect(() => { following.current = true; setShowLatest(false); }, [latestUserId]);
  const follow = () => { if (following.current) ref.current?.scrollToEnd({ animated: false }); else setShowLatest(true); };
  if (!ready) return <View className="flex-1 items-center justify-center"><Spinner /><Text className="text-muted pt-3">{t('chat.page.loadingConversations')}</Text></View>;
  if (messages.length === 0) return compact ? <ScrollView style={{ flex: 1 }} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 16 }}>
    <Text style={{ color: colors.fg, fontSize: 22, fontFamily: 'Inter_600SemiBold' }}>{t('chat.empty.heading')}</Text>
    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{t('chat.empty.body')}</Text>
    {prompts.slice(0, 2).map(prompt => <Pressable key={prompt} accessibilityRole="button" disabled={!onPromptTap || retryDisabled} onPress={() => onPromptTap?.(prompt)} style={{ minHeight: 44, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.fg, fontSize: 14 }}>{prompt}</Text></Pressable>)}
  </ScrollView> : <WelcomeState onPromptTap={onPromptTap} />;
  return (
    <View className="flex-1">
      <FlatList ref={ref} data={messages} keyExtractor={m => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onLayout={follow}
        onScrollBeginDrag={() => { following.current = false; }}
        onScroll={event => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          const nearEnd = contentSize.height - contentOffset.y - layoutMeasurement.height < 72;
          following.current = nearEnd;
          setShowLatest(!nearEnd);
        }} scrollEventThrottle={100}
        onContentSizeChange={follow}
        renderItem={({ item, index }) => <ChatMessage message={item} onShowSources={onShowSources} onRetry={index === messages.length - 1 ? onRetry : undefined} retryDisabled={retryDisabled} />}
        contentContainerStyle={{ paddingVertical: 8 }} />
      {showLatest ? <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center', backgroundColor: 'transparent' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('chat.page.goToLatest')} onPress={() => { following.current = true; setShowLatest(false); ref.current?.scrollToEnd({ animated: false }); }}
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
  const { t } = useI18n();
  const prompts = EXAMPLE_PROMPT_KEYS.map((key) => t(key));
  return (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 20 }}>
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
          {t('chat.empty.title')}{'\n'}
          <Text style={{ color: colors.accent, fontStyle: 'italic' }}>
            {t('chat.empty.titleAccent')}
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
          {t('chat.empty.subtitle')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        {prompts.map((ex) => (
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
    </ScrollView>
  );
};
