import { Feather } from '@expo/vector-icons';
import { copyWithCitations, prepareCitations, ITEM_PROTOCOL } from '@/lib/chatCitations';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Markdown, { renderRules, type ASTNode } from 'react-native-markdown-display';

import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType, CitedItem } from '@/types';

import { CitedItemsRail, InlineItemChip } from './ItemChip';

type Props = { message: ChatMessageType; onRetry?: () => void; retryDisabled?: boolean };

export const ChatMessage = React.memo(function ChatMessage({ message, onRetry, retryDisabled }: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
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

  const userText = colors.fg;
  const markdownStyle = useMemo(
    () => ({
      body: { color: isUser ? userText : colors.fg, fontSize: 16, lineHeight: 25, fontFamily: 'Inter_400Regular' },
      paragraph: { marginTop: 0, marginBottom: 10 },
      link: { color: isUser ? userText : colors.accent, fontWeight: '600' as const },
      strong: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const },
      em: { fontStyle: 'italic' as const },
      heading1: { fontSize: 22, fontWeight: '700' as const, marginTop: 14, marginBottom: 8, color: isUser ? userText : colors.fg },
      heading2: { fontSize: 19, fontWeight: '700' as const, marginTop: 14, marginBottom: 8, color: isUser ? userText : colors.fg },
      heading3: { fontSize: 17, fontWeight: '600' as const, marginTop: 14, marginBottom: 8, color: isUser ? userText : colors.fg },
      bullet_list: { marginTop: 2, marginBottom: 6 },
      ordered_list: { marginTop: 2, marginBottom: 6 },
      list_item: { marginBottom: 2 },
      blockquote: {
        borderWidth: 1,
        borderColor: colors.border,
        padding: 10,
        marginVertical: 4,
        backgroundColor: 'transparent',
      },
      code_inline: {
        backgroundColor: colors.surface,
        color: colors.fg,
        borderRadius: 4,
        paddingHorizontal: 4,
        fontFamily: 'Menlo',
        fontSize: 14,
      },
      code_block: {
        backgroundColor: colors.surface,
        color: colors.fg,
        padding: 10,
        borderRadius: 8,
        fontFamily: 'Menlo',
        fontSize: 13,
        marginVertical: 4,
      },
      fence: {
        backgroundColor: colors.surface,
        color: colors.fg,
        padding: 10,
        borderRadius: 8,
        fontFamily: 'Menlo',
        fontSize: 13,
        marginVertical: 4,
      },
      table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        marginVertical: 6,
      },
      th: { flex: 1, padding: 6, backgroundColor: colors.surface },
      td: { flex: 1, padding: 6, borderColor: colors.border },
      hr: { backgroundColor: colors.border, height: 1, marginVertical: 6 },
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
    <View className={`px-4 py-3 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser ? <View className="mb-3 flex-row flex-wrap items-center gap-2.5">
        <View accessible={false} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text accessible={false} style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 26, lineHeight: 30, color: colors.accent }}>f.</Text>
        </View>
        <Text className="text-fg text-sm font-medium">Flowy <Text className="text-muted text-xs">· AI</Text></Text>
        {message.streaming ? <Text accessibilityLiveRegion="polite" className="text-muted text-xs">{content ? 'Writing…' : 'Preparing response…'}</Text> : null}
      </View> : null}
      <View className={isUser ? 'max-w-[88%] rounded-2xl rounded-br-md bg-surface px-4 py-3' : 'w-full'}>
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
});
