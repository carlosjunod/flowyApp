import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { Thumbnail } from '@/components/ui/Thumbnail';
import { typeGlyph } from '@/lib/thumbnails';
import { useResolvedColors } from '@/lib/theme';
import type { ChatMessage as ChatMessageType, CitedItem, Item } from '@/types';

type Props = { message: ChatMessageType };

const CITE_RE = /\[\[([A-Za-z0-9_-]+)\]\]/g;
const ITEM_PROTO = 'item://';

const preprocessContent = (text: string, citations: CitedItem[]): string => {
  if (!text) return '';
  const indexById = new Map<string, number>();
  citations.forEach((c, i) => indexById.set(c.id, i + 1));
  let nextIdx = citations.length + 1;
  return text.replace(CITE_RE, (_, id: string) => {
    let idx = indexById.get(id);
    if (idx === undefined) {
      idx = nextIdx++;
      indexById.set(id, idx);
    }
    return `[${idx}](${ITEM_PROTO}${id})`;
  });
};

const citedItemToItem = (c: CitedItem): Item => ({
  id: c.id,
  user: '',
  type: c.type,
  title: c.title,
  category: c.category,
  source_url: c.source_url,
  r2_key: c.r2_key,
  tags: [],
  status: 'ready',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
});

export const ChatMessage: React.FC<Props> = ({ message }) => {
  const colors = useResolvedColors();
  const isUser = message.role === 'user';
  const citations = message.citations ?? [];

  const content = useMemo(
    () => preprocessContent(message.content, citations),
    [message.content, citations],
  );

  const markdownStyle = useMemo(
    () => ({
      body: { color: isUser ? '#FFFFFF' : colors.fg, fontSize: 16, fontFamily: 'Inter_400Regular' },
      paragraph: { marginTop: 0, marginBottom: 6 },
      link: { color: isUser ? '#FFFFFF' : colors.accent, fontWeight: '600' as const },
      strong: { fontWeight: '700' as const },
      em: { fontStyle: 'italic' as const },
      heading1: { fontSize: 22, fontWeight: '700' as const, marginTop: 4, marginBottom: 6, color: isUser ? '#FFFFFF' : colors.fg },
      heading2: { fontSize: 19, fontWeight: '700' as const, marginTop: 4, marginBottom: 6, color: isUser ? '#FFFFFF' : colors.fg },
      heading3: { fontSize: 17, fontWeight: '600' as const, marginTop: 4, marginBottom: 6, color: isUser ? '#FFFFFF' : colors.fg },
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
      th: {
        flex: 1,
        padding: 6,
        backgroundColor: isUser ? '#FFFFFF20' : colors.surface,
      },
      td: {
        flex: 1,
        padding: 6,
        borderColor: isUser ? '#FFFFFF40' : colors.border,
      },
      hr: { backgroundColor: isUser ? '#FFFFFF40' : colors.border, height: 1, marginVertical: 6 },
    }),
    [colors, isUser],
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
          isUser ? 'bg-accent' : 'bg-card border border-border'
        }`}
      >
        <Markdown style={markdownStyle} onLinkPress={onLinkPress}>
          {content || placeholder}
        </Markdown>
      </View>
      {!isUser && citations.length > 0 ? (
        <View className="mt-2 gap-2 w-full">
          {citations.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/item/${c.id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <Thumbnail item={citedItemToItem(c)} className="w-10 h-10" rounded="sm" />
              <View className="flex-1">
                <Text
                  className="text-sm font-medium text-fg"
                  style={{ fontFamily: 'Inter_500Medium' }}
                  numberOfLines={1}
                >
                  [{i + 1}] {c.title ?? typeGlyph[c.type]} {c.title ? '' : c.type}
                </Text>
                {c.category ? <Text className="text-xs text-muted">{c.category}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};
