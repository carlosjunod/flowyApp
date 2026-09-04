import { router } from 'expo-router';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ENV } from '@/lib/env';
import { useResolvedColors } from '@/lib/theme';
import { hostOf } from '@/lib/thumbnails';
import type { CitedItem } from '@/types';

const stripWww = (h: string) => h.replace(/^www\./, '');

/**
 * Returns the best available thumbnail URL for a chat-cited item. Priority:
 *   1. r2_key (uploaded media)
 *   2. og_image (link unfurl image)
 *   3. domain favicon as last-resort visual cue
 */
export function thumbnailUrlForRef(ref: CitedItem): string | null {
  if (ref.r2_key) return `${ENV.R2_PUBLIC_URL}/${ref.r2_key}`;
  if (ref.og_image) return ref.og_image;
  const u = ref.source_url ?? ref.raw_url;
  if (u) {
    const host = hostOf(u);
    if (host)
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  }
  return null;
}

export function domainLabelForRef(ref: CitedItem): string {
  if (ref.title) return ref.title;
  if (ref.site_name) return ref.site_name;
  const u = ref.source_url ?? ref.raw_url;
  if (u) {
    const host = hostOf(u);
    if (host) return stripWww(host);
  }
  return ref.id.slice(0, 6);
}

type InlineProps = {
  ref?: CitedItem;
  id: string;
  index?: number;
};

/**
 * Inline pill rendered for `item://` links inside markdown — small, baseline-
 * aligned, tappable to open the item detail. Maps to apps/web/components/chat/
 * ItemChip.tsx's inline chip (without the long-press menu — RN users get the
 * "Reload/Delete" actions from the item detail screen instead).
 */
export const InlineItemChip: React.FC<InlineProps> = ({ ref, id, index }) => {
  const colors = useResolvedColors();
  const [thumbErr, setThumbErr] = useState(false);
  const label = ref ? domainLabelForRef(ref) : id.slice(0, 6);
  const thumb = ref ? thumbnailUrlForRef(ref) : null;

  return (
    <Pressable
      onPress={() => router.push(`/item/${id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      hitSlop={2}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.accent + '4D',
          backgroundColor: colors.accent + '22',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {thumb && !thumbErr ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: 12, height: 12, borderRadius: 2 }}
          contentFit="cover"
          onError={() => setThumbErr(true)}
        />
      ) : null}
      {typeof index === 'number' ? (
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            color: colors.accent,
          }}
        >
          [{index}]
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
          color: colors.accent,
          maxWidth: 160,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

type RailProps = {
  items: CitedItem[];
  label: string;
};

/**
 * Horizontal item rail that follows an assistant message. Shows actual cited
 * items when available, otherwise a "Might be related" fallback (first 3 items
 * the LLM had in context). Mirrors apps/web/components/chat/ChatMessage.tsx
 * rail behavior.
 */
export const CitedItemsRail: React.FC<RailProps> = ({ items, label }) => {
  const colors = useResolvedColors();
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10.5,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: colors.muted,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.map((it, i) => (
          <RailChip key={it.id} ref={it} index={i + 1} />
        ))}
      </View>
    </View>
  );
};

const RailChip: React.FC<{ ref: CitedItem; index: number }> = ({ ref, index }) => {
  const colors = useResolvedColors();
  const [thumbErr, setThumbErr] = useState(false);
  const thumb = thumbnailUrlForRef(ref);
  const label = domainLabelForRef(ref);

  return (
    <Pressable
      onPress={() => router.push(`/item/${ref.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${label}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 6,
          paddingRight: 10,
          paddingVertical: 5,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          maxWidth: 220,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {thumb && !thumbErr ? (
          <Image
            source={{ uri: thumb }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            onError={() => setThumbErr(true)}
          />
        ) : (
          <Text style={{ fontSize: 14, color: colors.muted }}>·</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
            color: colors.fg,
          }}
        >
          [{index}] {label}
        </Text>
        {ref.category ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 10.5,
              color: colors.muted,
            }}
          >
            {ref.category}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};
