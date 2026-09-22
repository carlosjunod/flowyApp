import { ReaderImage } from './ReaderImage';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ENV } from '@/lib/env';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { MediaSlide } from '@/types';

type Props = {
  slides: MediaSlide[];
  width: number;
  height?: number;
};

export const MediaCarousel: React.FC<Props> = ({ slides, width, height = 240 }) => {
  const [index, setIndex] = useState(0);
  const { t, formatNumber } = useI18n();
  const colors = useResolvedColors();

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width === 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [index, width],
  );

  if (slides.length === 0) return null;
  const active = slides[index];

  return (
    <View className="gap-2">
      <View style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
        <FlatList
          horizontal
          data={slides}
          keyExtractor={(s) => `${s.index}-${s.r2_key}`}
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          snapToInterval={width}
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={{ width, height }} className="bg-surface">
              <ReaderImage uri={`${ENV.R2_PUBLIC_URL}/${item.r2_key}`} label={item.summary ?? t('inbox.content.image', { index: item.index + 1 })} />
            </View>
          )}
        />
        <View className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60">
          <Text
            className="text-white"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11 }}
          >
            {formatNumber(index + 1)} / {formatNumber(slides.length)}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-center gap-1.5">
        {slides.map((s, i) => (
          <View
            key={`dot-${s.index}-${i}`}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>

      {active?.summary ? (
        <Text className="text-sm text-muted px-1">{active.summary}</Text>
      ) : null}
      {active?.transcript ? <TranscriptBlock transcript={active.transcript} /> : null}
    </View>
  );
};

const TranscriptBlock: React.FC<{ transcript: string }> = ({ transcript }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useI18n();
  return (
    <View className="px-1 gap-1">
      <Text className="text-xs uppercase text-muted tracking-wide">{t('inbox.content.spokenAudio')}</Text>
      <Text
        className="text-sm text-fg"
        numberOfLines={expanded ? undefined : 2}
      >
        {transcript}
      </Text>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" hitSlop={6}>
        <Text className="text-xs text-accent font-medium">
          {expanded ? t('common.actions.showLess') : t('common.actions.showMore')}
        </Text>
      </Pressable>
    </View>
  );
};
