import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

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
    <Pressable
      disabled={pending}
      onPress={() => {
        if (errored) return;
        router.push(`/item/${item.id}`);
      }}
      className={`flex-row items-center gap-3 px-4 py-3 border-b border-border ${
        pending ? 'opacity-60' : ''
      } ${errored ? 'border-l-4 border-l-danger' : ''}`}
    >
      <View className="w-10 h-10 rounded-lg bg-card items-center justify-center">
        <Text className="text-xl">{typeGlyph[item.type]}</Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base text-fg font-medium" numberOfLines={1}>
          {item.title ?? 'Untitled'}
        </Text>
        <View className="flex-row items-center gap-2">
          {item.category ? <Badge label={item.category} /> : null}
          <Text className="text-xs text-muted">{relativeDate(item.created)}</Text>
        </View>
      </View>
      {pending ? <Spinner /> : null}
    </Pressable>
  );
};
