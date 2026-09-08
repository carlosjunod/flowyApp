import { Feather } from '@expo/vector-icons';
import { copyWithCitations, prepareCitations, ITEM_PROTOCOL } from '@/lib/chatCitations';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Markdown, { renderRules, type ASTNode } from 'react-native-markdown-display';

import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType, CitedItem } from '@/types';

import { CitedItemsRail, InlineItemChip } from './ItemChip';

type Props = { message: ChatMessageType; onRetry?: () => void; retryDisabled?: boolean };

export const ChatMessage: React.FC<Props> = ({ message, onRetry, retryDisabled }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const [copyLabel, setCopyLabel] = useState('Copy');
  const colors = useResolvedColors();
  const isUser = message.role === 'user';
  const items = message.citations ?? [];
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { content, indexById } = useMemo(
    () => (isUser ? { content: message.content, indexById: new Map() } : prepareCitations(message.content)),
    [isUser, message.content],
  );

  // Items that actually got cited in the message body. Used to label the rail
  // and to pick the right fallback strategy.
  const citedItems = useMemo(
    () =>
      Array.from(indexById.keys())
        .map((id) => byId.get(id))
        .filter((x): x is CitedItem => Boolean(x)),
    [indexById, byId],
  );

  // Web parity: if no citations were emitted, surface up to 3 of the items the
  // LLM had context on as a "might be related" rail.
  const railItems = citedItems.length > 0 ? citedItems : items.slice(0, 3);
  const railLabel = citedItems.length > 0 ? 'Sources' : 'Related saves';

  const userText = colors.bg;
  const markdownStyle = useMemo(
    () => ({
      body: { color: isUser ? userText : colors.fg, fontSize: 16, lineHeight: 25, fontFamily: 'Inter_400Regular' },
      paragraph: { marginTop: 0, marginBottom: 10 },
      link: { color: isUser ? userText : colors.accent, fontWeight: '600' as const },
      strong: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
      em: { fontStyle: 'italic' as const },
      heading1: { fontSize: 22, fontWeight: '700' as const, marginTop: 4, marginBottom: 6, color: isUser ? userText : colors.fg },
      heading2: { fontSize: 19, fontWeight: '700' as const, marginTop: 4, marginBottom: 6, color: isUser ? userText : colors.fg },
      heading3: { fontSize: 17, fontWeight: '600' as const, marginTop: 4, marginBottom: 6, color: isUser ? userText : colors.fg },
      bullet_list: { marginTop: 2, marginBottom: 6 },
      ordered_list: { marginTop: 2, marginBottom: 6 },
      list_item: { marginBottom: 2 },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: isUser ? '#FFFFFF80' : colors.accent,
        paddingLeft: 10,
        marginVertical: 4,
        backgroundColor: 'transparent',
      },
      code_inline: {
        backgroundColor: isUser ? '#FFFFFF26' : colors.surface,
        color: isUser ? '#FFFFFF' : colors.fg,
        borderRadius: 4,
        paddingHorizontal: 4,
        fontFamily: 'Menlo',
        fontSize: 14,
      },
      code_block: {
        backgroundColor: isUser ? '#FFFFFF14' : colors.surface,
        color: isUser ? '#FFFFFF' : colors.fg,
        padding: 10,
        borderRadius: 8,
        fontFamily: 'Menlo',
        fontSize: 13,
        marginVertical: 4,
      },
      fence: {
        backgroundColor: isUser ? '#FFFFFF14' : colors.surface,
        color: isUser ? '#FFFFFF' : colors.fg,
        padding: 10,
        borderRadius: 8,
        fontFamily: 'Menlo',
        fontSize: 13,
        marginVertical: 4,
      },
      table: {
        borderWidth: 1,
        borderColor: isUser ? '#FFFFFF40' : colors.border,
        borderRadius: 6,
        marginVertical: 6,
      },
      th: { flex: 1, padding: 6, backgroundColor: isUser ? '#FFFFFF20' : colors.surface },
      td: { flex: 1, padding: 6, borderColor: isUser ? '#FFFFFF40' : colors.border },
      hr: { backgroundColor: isUser ? '#FFFFFF40' : colors.border, height: 1, marginVertical: 6 },
    }),
    [colors, isUser, userText],
  );

  // Keep citation links as native Text spans so paragraph line metrics stay intact.
  const rules = useMemo(
    () => ({
      link: (
        node: ASTNode,
        children: React.ReactNode[],
        parent: ASTNode[],
        styles: Record<string, unknown>,
        onLinkPress?: (url: string) => boolean,
      ) => {
        const href = (node.attributes?.href as string | undefined) ?? '';
        if (href.startsWith(ITEM_PROTOCOL)) {
          const id = href.slice(ITEM_PROTOCOL.length);
          return (
            <InlineItemChip
              key={node.key}
              id={id}
              item={byId.get(id)}
              index={indexById.get(id)}
            />
          );
        }
        // Delegate to the library's own renderer. Returning `undefined` here
        // does NOT fall through: AstRenderer.renderNode uses whatever the
        // registered rule returns, so every ordinary markdown link — its text
        // included — was silently dropped from the message.
        // Typed as possibly-undefined; fall back to plain text so a link can
        // still never vanish, which is the bug being fixed here.
        return (
          renderRules.link?.(node, children, parent, styles, onLinkPress) ?? (
            <Text key={node.key}>{children}</Text>
          )
        );
      },
    }),
    [byId, indexById],
  );

  const onLinkPress = (url: string): boolean => {
    if (url.startsWith(ITEM_PROTOCOL)) {
      router.push(`/item/${url.slice(ITEM_PROTOCOL.length)}`);
      return false;
    }
    return /^(https?:|mailto:)/i.test(url);
  };


  return (
    <View className={`px-4 py-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <View
        className={`${isUser ? 'max-w-[88%]' : 'w-full'} rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary' : 'bg-card border border-border'
        }`}
      >
        {message.streaming && !content ? <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">{focused && !reducedMotion ? <ActivityIndicator color={colors.muted} size="small" /> : null}<Text className="text-muted">Preparing response…</Text></View> : null}
        <Markdown style={markdownStyle} rules={rules} onLinkPress={onLinkPress}>
          {content}
        </Markdown>
      </View>
      {!isUser && (message.error || message.interrupted) ? <Text accessibilityRole="alert" className="text-danger text-sm py-2">{message.error ?? 'Response stopped. You can retry when ready.'}</Text> : null}
      {!isUser && !message.streaming ? (
        <View className="w-full" style={{ paddingTop: 4 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            {message.content ? (
              <Pressable accessibilityRole="button" accessibilityLabel={copyLabel} className="min-h-[44px] flex-row items-center gap-2 px-2 rounded-lg active:bg-surface"
                onPress={() => { void Clipboard.setStringAsync(copyWithCitations(message.content, items)).then(() => setCopyLabel('Copied')).catch(() => setCopyLabel('Copy failed, retry')); }}>
                <Feather name={copyLabel === 'Copied' ? 'check' : 'copy'} size={14} color={colors.muted} accessible={false} />
                <Text className="text-muted text-xs" accessibilityLiveRegion="polite">{copyLabel}</Text>
              </Pressable>
            ) : null}
            {onRetry ? (
              <Pressable disabled={retryDisabled} accessibilityRole="button" accessibilityLabel="Retry response" accessibilityState={{ disabled: retryDisabled }} className="min-h-[44px] flex-row items-center gap-2 px-2 rounded-lg active:bg-surface" style={{ opacity: retryDisabled ? 0.4 : 1 }} onPress={onRetry}>
                <Feather name="rotate-cw" size={14} color={colors.muted} accessible={false} />
                <Text className="text-muted text-xs">Retry</Text>
              </Pressable>
            ) : null}
          </View>
          {railItems.length ? (
            <View style={{ paddingTop: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${railLabel}, ${railItems.length}`} accessibilityState={{ expanded: sourcesOpen }}
                className="self-start min-h-[44px] flex-row items-center gap-2 px-2 rounded-lg active:bg-surface" onPress={() => setSourcesOpen(value => !value)}>
                <Feather name={sourcesOpen ? 'chevron-down' : 'chevron-right'} size={16} color={colors.muted} accessible={false} />
                <Text className="text-muted text-sm">{railLabel} · {railItems.length}</Text>
              </Pressable>
              {sourcesOpen ? <CitedItemsRail items={railItems} indexById={indexById} /> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};
