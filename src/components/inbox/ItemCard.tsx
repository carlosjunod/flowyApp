import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
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
    <Pressable
      disabled={pending}
      onPress={() => {
        if (errored) return;
        router.push(`/item/${item.id}`);
      }}
      className={`bg-card rounded-xl overflow-hidden border ${
        errored ? 'border-danger' : 'border-border'
      } ${pending ? 'opacity-60' : ''}`}
      style={{ height: 176 }}
    >
      <View className="flex-1 relative">
        <Thumbnail item={item} className="flex-1" rounded="sm" />
        {pending ? (
          <View className="absolute inset-0 items-center justify-center bg-black/20">
            <Spinner />
          </View>
        ) : null}
      </View>
      <View className="px-3 py-2 gap-1">
        <Text className="text-sm font-semibold text-fg" numberOfLines={1}>
          {item.title ?? 'Untitled'}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1 flex-1 pr-2">
            <Text className="text-xs text-muted">{typeGlyph[item.type]}</Text>
            {item.category ? <Badge label={item.category} /> : null}
          </View>
          <Text className="text-xs text-muted">{relativeDate(item.created)}</Text>
        </View>
      </View>
    </Pressable>
  );
};
