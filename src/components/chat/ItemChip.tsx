import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ENV } from '@/lib/env';
import { domainLabelForRef } from '@/lib/chatCitations';
import { itemTypeIcon } from '@/lib/itemIcons';
import { useResolvedColors } from '@/lib/theme';
import { extractYoutubeId, hostOf } from '@/lib/thumbnails';
import type { CitedItem } from '@/types';

export { domainLabelForRef } from '@/lib/chatCitations';

export function thumbnailUrlForRef(item: CitedItem): string | null {
  if (item.r2_key) return `${ENV.R2_PUBLIC_URL}/${item.r2_key}`;
  if (item.type === 'youtube') {
    const id = extractYoutubeId(item.source_url || item.raw_url || '');
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  if (item.og_image) return item.og_image;
  const host = hostOf(item.source_url || item.raw_url || '');
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : null;
}

/** Native Text spans keep citations on the paragraph baseline; no inline View/image. */
export function InlineItemChip({ item, id, index }: { item?: CitedItem; id: string; index?: number }) {
  const colors = useResolvedColors();
  return (
    <Text
      onPress={() => router.push(`/item/${id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Open source ${index ?? ''}: ${item?.title?.trim() || 'Saved source'}`}
      suppressHighlighting={false}
      style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.fg, backgroundColor: colors.surface }}
    >
      {`\u00a0[${index ?? '?'}]\u00a0`}
    </Text>
  );
}

/** One readable column on phones; two columns when the actual container allows it. */
export function CitedItemsRail({ items, indexById }: { items: CitedItem[]; indexById: Map<string, number> }) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const twoColumns = width >= 620 * Math.max(1, fontScale);
  if (!items.length) return null;
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.rail}>
      {items.map(item => (
        <SourceCard key={item.id} item={item} index={indexById.get(item.id)} width={twoColumns ? (width - 12) / 2 : undefined} />
      ))}
    </View>
  );
}

function SourceCard({ item, index, width }: { item: CitedItem; index?: number; width?: number }) {
  const colors = useResolvedColors();
  const [pressed, setPressed] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const thumb = thumbnailUrlForRef(item);
  const title = item.title?.trim() || 'Untitled save';
  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}`)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${index ? `source ${index}` : 'saved item'}: ${title}, ${domainLabelForRef(item)}`}
      style={[styles.card, {
        width: width ?? '100%', borderColor: pressed ? colors.accent : colors.border,
        backgroundColor: pressed ? colors.surface : colors.card,
      }]}
    >
      <View style={[styles.thumbnail, { backgroundColor: colors.surface }]} accessible={false}>
        {thumb && thumb !== failedUrl ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailedUrl(thumb)} />
        ) : <Feather name={itemTypeIcon[item.type] || 'file'} size={20} color={colors.muted} />}
      </View>
      <View style={styles.description}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.fg }]}>
          {index ? <Text style={{ color: colors.accent }}>{`[${index}]  `}</Text> : null}{title}
        </Text>
        <View style={styles.source}>
          <Feather name="link" size={12} color={colors.muted} accessible={false} />
          <Text numberOfLines={1} style={[styles.domain, { color: colors.muted }]}>{domainLabelForRef(item)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%', paddingTop: 4 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, minHeight: 96 },
  thumbnail: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  description: { flex: 1, minWidth: 0, gap: 8 },
  title: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  domain: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
