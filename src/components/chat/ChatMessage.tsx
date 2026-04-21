import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { Thumbnail } from '@/components/ui/Thumbnail';
import { typeGlyph } from '@/lib/thumbnails';
import type { ChatMessage as ChatMessageType, CitedItem, Item } from '@/types';

type Props = { message: ChatMessageType };

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'cite'; itemId: string; index: number };

const CITE_RE = /\[\[([A-Za-z0-9_-]+)\]\]/g;

const buildSegments = (text: string, citations: CitedItem[]): Segment[] => {
  const indexById = new Map<string, number>();
  citations.forEach((c, i) => indexById.set(c.id, i + 1));
  const result: Segment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  CITE_RE.lastIndex = 0;
  while ((match = CITE_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      result.push({ kind: 'text', value: text.slice(cursor, match.index) });
    }
    const id = match[1] ?? '';
    const idx = indexById.get(id) ?? indexById.size + 1;
    if (!indexById.has(id)) indexById.set(id, idx);
    result.push({ kind: 'cite', itemId: id, index: idx });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    result.push({ kind: 'text', value: text.slice(cursor) });
  }
  return result;
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
  const isUser = message.role === 'user';
  const citations = message.citations ?? [];
  const segments = useMemo(
    () => buildSegments(message.content, citations),
    [message.content, citations],
  );
  const plainText = segments.every((s) => s.kind === 'text');

  return (
    <View
      className={`px-4 py-2 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <View
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-accent' : 'bg-card border border-border'
        }`}
      >
        {plainText && !isUser ? (
          <Markdown style={markdownStyle}>
            {message.content || (message.streaming ? '…' : '')}
          </Markdown>
        ) : (
          <Text className={isUser ? 'text-white text-base' : 'text-fg text-base'}>
            {segments.map((s, i) =>
              s.kind === 'text' ? (
                <Text key={i}>{s.value}</Text>
              ) : (
                <Text
                  key={i}
                  className="text-accent font-semibold"
                  onPress={() => router.push(`/item/${s.itemId}`)}
                >
                  [{s.index}]
                </Text>
              ),
            )}
            {message.streaming && !message.content ? (
              <Text className="text-muted">…</Text>
            ) : null}
          </Text>
        )}
      </View>
      {!isUser && citations.length > 0 ? (
        <View className="mt-2 gap-2 w-full">
          {citations.map((c, i) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/item/${c.id}`)}
              className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
            >
              <Thumbnail item={citedItemToItem(c)} className="w-10 h-10" rounded="sm" />
              <View className="flex-1">
                <Text className="text-sm font-medium text-fg" numberOfLines={1}>
                  [{i + 1}] {c.title ?? typeGlyph[c.type]} {c.title ? '' : c.type}
                </Text>
                {c.category ? (
                  <Text className="text-xs text-muted">{c.category}</Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const markdownStyle = {
  body: { color: '#0f172a', fontSize: 16 },
  link: { color: '#6366f1' },
  code_inline: { backgroundColor: '#e2e8f0', borderRadius: 4, paddingHorizontal: 4 },
  code_block: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
} as const;
