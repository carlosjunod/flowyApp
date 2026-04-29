import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { hostOf, thumbnailFor, typeGlyph } from '@/lib/thumbnails';
import type { ChatMessage, CitedItem, Item } from '@/types';

type Props = {
  messages: ChatMessage[];
};

const stripWww = (h: string) => h.replace(/^www\./, '');

const collectCited = (messages: ChatMessage[]): CitedItem[] => {
  const seen = new Set<string>();
  const out: CitedItem[] = [];
  for (const m of messages) {
    if (!m.citations) continue;
    for (const c of m.citations) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
};

const citedToItem = (c: CitedItem): Item => ({
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

export const ConversationItemsStrip: React.FC<Props> = ({ messages }) => {
  const items = useMemo(() => collectCited(messages), [messages]);
  if (items.length === 0) return null;

  return (
    <View className="pt-3 pb-2 border-b border-border">
      <Text
        className="text-muted px-4 mb-2"
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 }}
      >
        ITEMS IN THIS CONVERSATION
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      >
        {items.map((c) => (
          <MiniImageLedCard key={c.id} cited={c} />
        ))}
      </ScrollView>
    </View>
  );
};

const MiniImageLedCard: React.FC<{ cited: CitedItem }> = ({ cited }) => {
  const item = citedToItem(cited);
  const thumb = thumbnailFor(item);
  const url = cited.source_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;

  return (
    <Pressable
      onPress={() => router.push(`/item/${cited.id}`)}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      className="rounded-2xl overflow-hidden bg-card border border-border"
      accessibilityLabel={cited.title ?? 'Cited item'}
    >
      <View style={{ width: 140 }}>
        <View style={{ height: 96 }} className="relative bg-surface">
          {thumb.kind === 'image' ? (
            <Image
              source={{ uri: thumb.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-3xl">{thumb.glyph}</Text>
            </View>
          )}
          {domainLabel ? (
            <View
              className="absolute top-1.5 left-1.5 flex-row items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
            >
              {faviconUri ? (
                <Image
                  source={{ uri: faviconUri }}
                  style={{ width: 10, height: 10, borderRadius: 2 }}
                  contentFit="contain"
                />
              ) : null}
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 10,
                  color: '#1C1815',
                  maxWidth: 92,
                }}
                numberOfLines={1}
              >
                {domainLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="px-2.5 py-2 gap-0.5" style={{ height: 64 }}>
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 15 }}
            numberOfLines={2}
          >
            {cited.title ?? typeGlyph[cited.type]}
          </Text>
          {cited.category ? (
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 10 }}
              numberOfLines={1}
            >
              {cited.category}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};
