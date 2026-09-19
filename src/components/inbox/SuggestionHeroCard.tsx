import { AppIcon } from '@/components/ui/AppIcon';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { thumbnailFor } from '@/lib/thumbnails';
import type { Item, ViewMode } from '@/types';

type Props = {
  items: Item[];
  viewMode: ViewMode;
  onPress?: () => void;
};

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The headline is chosen here and rendered by the caller, so this returns a key
 * plus its variables rather than a sentence — the category in the third variant
 * is the user's own word and is interpolated, not translated.
 */
type Headline = { key: string; vars?: Record<string, string | number> };

const headlineFor = (items: Item[]): { headline: Headline; topic: string | null } => {
  if (items.length === 0) {
    return { headline: { key: 'inbox.suggestion.empty' }, topic: null };
  }
  const counts: Record<string, number> = {};
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  for (const item of items) {
    const t = new Date(item.created).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    const cat = item.category;
    if (!cat) continue;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) {
    return {
      headline: { key: 'inbox.suggestion.waiting', vars: { count: items.length } },
      topic: null,
    };
  }
  const [cat, count] = top;
  return {
    headline: { key: 'inbox.suggestion.topic', vars: { count, category: cat.toLocaleLowerCase() } },
    topic: cat,
  };
};

export const SuggestionHeroCard: React.FC<Props> = ({ items, viewMode, onPress }) => {
  const { t, tKey } = useI18n();
  const { headline: headlineParts, topic } = useMemo(() => headlineFor(items), [items]);
  const headline = tKey(headlineParts.key, headlineParts.vars);
  const thumbs = useMemo(() => {
    const pool = topic
      ? items.filter((it) => it.category === topic)
      : items;
    return pool.slice(0, 6);
  }, [items, topic]);
  const overflow = Math.max(0, (topic ? items.filter((it) => it.category === topic).length : items.length) - 5);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('inbox.suggestion.label', { headline })}
      style={({ pressed }) => [pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
      className="mx-4 mb-4 rounded-[20px] bg-accent overflow-hidden"
    >
      <View className="px-5 pt-5 pb-5 gap-4">
        <View className="flex-row items-center gap-2">
          <View className="w-1.5 h-1.5 rounded-full bg-white/90" />
          <Text
            className="text-white/90"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1 }}
          >
            {t('inbox.suggestion.eyebrow')}
          </Text>
        </View>
        <Text
          className="text-white"
          style={{
            fontFamily: 'InstrumentSerif_400Regular',
            fontSize: 28,
            lineHeight: 32,
            letterSpacing: -0.4,
          }}
          numberOfLines={3}
        >
          {headline}
        </Text>
        {viewMode === 'grid' ? (
          <View className="flex-row items-center gap-2 pt-1">
            {thumbs.slice(0, 5).map((it) => {
              const t = thumbnailFor(it);
              return (
                <View
                  key={it.id}
                  className="rounded-lg bg-white/15 overflow-hidden border border-white/30"
                  style={{ width: 36, height: 36 }}
                >
                  {t.kind === 'image' ? (
                    <Image
                      source={{ uri: t.uri }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <AppIcon name={t.icon} size={18} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              );
            })}
            {overflow > 0 ? (
              <View
                className="rounded-lg items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                <Text
                  className="text-white"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12 }}
                >
                  +{overflow}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View className="flex-row items-center gap-2">
            <View className="px-2.5 py-1 rounded-full bg-white/20">
              <Text
                className="text-white"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.6 }}
              >
                {t('inbox.suggestion.digestBadge')}
              </Text>
            </View>
            <Text
              className="text-white/90"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              {t('inbox.suggestion.readyToReview')}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};
