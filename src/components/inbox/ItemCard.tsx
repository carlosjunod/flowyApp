import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge } from '@/components/ui/Badge';
import { Shimmer } from '@/components/ui/Shimmer';
import { Spinner } from '@/components/ui/Spinner';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { relativeDate } from '@/lib/relativeDate';
import { typeGlyph } from '@/lib/thumbnails';
import type { Item } from '@/types';

const isPending = (item: Item) => item.status === 'pending' || item.status === 'processing';

type Props = { item: Item };

export const ItemCard: React.FC<Props> = ({ item }) => {
  const pending = isPending(item);
  const errored = item.status === 'error';
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        disabled={pending}
        onPress={() => {
          if (errored) return;
          router.push(`/item/${item.id}`);
        }}
        style={({ pressed }) => [
          { height: 176, elevation: 2 },
          pressed && !pending && { transform: [{ scale: 0.98 }], opacity: 0.97 },
        ]}
        className={`bg-card rounded-2xl overflow-hidden border shadow-card ${
          errored ? 'border-danger' : 'border-border'
        } ${pending ? 'opacity-80' : ''}`}
      >
        <View className="flex-1 relative">
          <Thumbnail item={item} className="flex-1" rounded="sm" />
          {item.media && item.media.length > 1 ? (
            <View className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/60">
              <Text className="text-white text-[10px] font-semibold">
                1/{item.media.length}
              </Text>
            </View>
          ) : null}
          {pending ? (
            <>
              <Shimmer />
              <View className="absolute inset-0 items-center justify-center">
                <Spinner tint="muted" />
              </View>
            </>
          ) : null}
        </View>
        <View className="px-3 py-2 gap-1">
          <Text
            className="text-sm font-semibold text-fg"
            style={{ fontFamily: 'Inter_600SemiBold' }}
            numberOfLines={1}
          >
            {item.title ?? 'Untitled'}
          </Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1 flex-1 pr-2">
              <Text className="text-xs text-muted">{typeGlyph[item.type]}</Text>
              {item.category ? <Badge label={item.category} palette={item.category} /> : null}
            </View>
            <Text className="text-xs text-muted">{relativeDate(item.created)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};
