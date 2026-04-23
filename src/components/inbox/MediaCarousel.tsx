import { Image } from 'expo-image';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ENV } from '@/lib/env';
import { useResolvedColors } from '@/lib/theme';
import type { MediaSlide } from '@/types';

type Props = {
  slides: MediaSlide[];
  width: number;
  height?: number;
};

export const MediaCarousel: React.FC<Props> = ({ slides, width, height = 240 }) => {
  const [index, setIndex] = useState(0);
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
      <View style={{ position: 'relative' }}>
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
              <Image
                source={{ uri: `${ENV.R2_PUBLIC_URL}/${item.r2_key}` }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
              />
            </View>
          )}
        />
        <View className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/60">
          <Text className="text-white text-xs font-semibold">
            {index + 1} / {slides.length}
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
    </View>
  );
};
