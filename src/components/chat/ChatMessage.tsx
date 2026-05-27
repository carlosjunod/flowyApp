import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Markdown, { type ASTNode } from 'react-native-markdown-display';

import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType, CitedItem } from '@/types';

import { CitedItemsRail, InlineItemChip } from './ItemChip';

type Props = { message: ChatMessageType };

const CITE_RE = /\[\[([A-Za-z0-9_-]+)\]\]/g;
const ITEM_PROTO = 'item://';

/**
 * Convert `[[id]]` placeholders into `[N](item://id)` markdown links, indexing
 * by first-occurrence so the same id reuses its index. The link is then
 * intercepted by the markdown `link` rule and rendered as an InlineItemChip.
 */
function preprocessContent(text: string, items: CitedItem[]): { content: string; indexById: Map<string, number> } {
  if (!text) return { content: '', indexById: new Map() };
  const seedIds = new Set(items.map((i) => i.id));
  const indexById = new Map<string, number>();
  let nextIdx = 1;
  const content = text.replace(CITE_RE, (_match, id: string) => {
    let idx = indexById.get(id);
    if (idx === undefined) {
      idx = nextIdx++;
      indexById.set(id, idx);
    }
    // Even if the id wasn't in the items list, we still render a chip; it'll
    // route to /item/:id which can show its own "not found" state.
    void seedIds; // keep seedIds reference for future use (status badges)
    return `[${idx}](${ITEM_PROTO}${id})`;
  });
  return { content, indexById };
}

export const ChatMessage: React.FC<Props> = ({ message }) => {
  const colors = useResolvedColors();
  const isUser = message.role === 'user';
  const items = message.citations ?? [];
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const { content, indexById } = useMemo(
    () => (isUser ? { content: message.content, indexById: new Map() } : preprocessContent(message.content, items)),
    [isUser, message.content, items],
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
  const railLabel = citedItems.length > 0 ? 'Items in this conversation' : 'Might be related';

  const userText = colors.bg;
  const markdownStyle = useMemo(
    () => ({
      body: { color: isUser ? userText : colors.fg, fontSize: 16, fontFamily: 'Inter_400Regular' },
      paragraph: { marginTop: 0, marginBottom: 6 },
      link: { color: isUser ? userText : colors.accent, fontWeight: '600' as const },
      strong: { fontWeight: '700' as const },
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

  // Override the `link` rule so `item://` links become InlineItemChip pills
  // with thumbnail + index + domain — same idiom as the web ChatMessage's
  // `<a>` override. All other links get default behavior.
  const rules = useMemo(
    () => ({
      link: (node: ASTNode) => {
        const href = (node.attributes?.href as string | undefined) ?? '';
        if (href.startsWith(ITEM_PROTO)) {
          const id = href.slice(ITEM_PROTO.length);
          return (
            <InlineItemChip
              key={node.key}
              id={id}
              ref={byId.get(id)}
              index={indexById.get(id)}
            />
          );
        }
        // Returning undefined lets default rendering handle it.
        return undefined;
      },
    }),
    [byId, indexById],
  );

  const onLinkPress = (url: string): boolean => {
    if (url.startsWith(ITEM_PROTO)) {
      router.push(`/item/${url.slice(ITEM_PROTO.length)}`);
      return false;
    }
    return true;
  };

  const placeholder = !content && message.streaming ? '…' : '';

  return (
    <View className={`px-4 py-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary' : 'bg-card border border-border'
        }`}
      >
        <Markdown style={markdownStyle} rules={rules} onLinkPress={onLinkPress}>
          {content || placeholder}
        </Markdown>
      </View>
      {!isUser && !message.streaming ? (
        <CitedItemsRail items={railItems} label={railLabel} />
      ) : null}
    </View>
  );
};
