import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { relativeDate } from '@/lib/relativeDate';
import type { Item } from '@/types';

const pendingStatus = (item: Item) =>
  item.status === 'pending' || item.status === 'processing';

type Props = { item: Item };

export const ItemDetailRow: React.FC<Props> = ({ item }) => {
  const pending = pendingStatus(item);
  const errored = item.status === 'error';
  return (
    <Pressable
      disabled={pending}
      onPress={() => {
        if (errored) return;
        router.push(`/item/${item.id}`);
      }}
      className={`flex-row gap-3 px-4 py-3 border-b border-border ${
        pending ? 'opacity-60' : ''
      } ${errored ? 'border-l-4 border-l-danger' : ''}`}
    >
      <Thumbnail item={item} className="w-24 h-24" rounded="md" />
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-fg" numberOfLines={1}>
          {item.title ?? 'Untitled'}
        </Text>
        {item.summary ? (
          <Text className="text-sm text-muted" numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap items-center gap-1">
          {(item.tags ?? []).slice(0, 4).map((tag) => (
            <Badge key={tag} label={tag} tone="accent" />
          ))}
          <Text className="text-xs text-muted ml-1">{relativeDate(item.created)}</Text>
        </View>
      </View>
      {pending ? <Spinner /> : null}
    </Pressable>
  );
};
