import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { relativeDate } from '@/lib/relativeDate';
import { typeGlyph } from '@/lib/thumbnails';
import type { Item } from '@/types';

const pendingStatus = (item: Item) =>
  item.status === 'pending' || item.status === 'processing';

type Props = { item: Item };

export const ItemRow: React.FC<Props> = ({ item }) => {
  const pending = pendingStatus(item);
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
          pressed && !pending && { transform: [{ scale: 0.99 }], opacity: 0.97 },
        ]}
        className={`flex-row items-center gap-3 px-4 py-3 border-b border-border ${
          pending ? 'opacity-70' : ''
        } ${errored ? 'border-l-4 border-l-danger' : ''}`}
      >
        <View className="w-10 h-10 rounded-lg bg-surface items-center justify-center relative">
          <Text className="text-xl">{typeGlyph[item.type]}</Text>
          {item.media && item.media.length > 1 ? (
            <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent items-center justify-center">
              <Text className="text-white text-[9px] font-bold">{item.media.length}</Text>
            </View>
          ) : null}
        </View>
        <View className="flex-1 gap-1">
          <Text
            className="text-base text-fg font-medium"
            style={{ fontFamily: 'Inter_500Medium' }}
            numberOfLines={1}
          >
            {item.title ?? 'Untitled'}
          </Text>
          <View className="flex-row items-center gap-2">
            {item.category ? <Badge label={item.category} palette={item.category} /> : null}
            <Text className="text-xs text-muted">{relativeDate(item.created)}</Text>
          </View>
        </View>
        {pending ? <Spinner tint="muted" /> : null}
      </Pressable>
    </Animated.View>
  );
};
