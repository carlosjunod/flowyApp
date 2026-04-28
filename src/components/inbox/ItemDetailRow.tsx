import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Thumbnail } from '@/components/ui/Thumbnail';
import { relativeDate } from '@/lib/relativeDate';
import { useSelection } from '@/lib/selection';
import type { Item } from '@/types';

const pendingStatus = (item: Item) =>
  item.status === 'pending' || item.status === 'processing';

type Props = { item: Item };

export const ItemDetailRow: React.FC<Props> = ({ item }) => {
  const pending = pendingStatus(item);
  const errored = item.status === 'error';
  const selection = useSelection();
  const selected = selection.selectedIds.has(item.id);

  const handlePress = () => {
    if (selection.mode) {
      selection.toggle(item.id);
      return;
    }
    if (pending || errored) return;
    router.push(`/item/${item.id}`);
  };

  const handleLongPress = () => {
    if (pending) return;
    if (!selection.mode) selection.enterWith(item.id);
    else selection.toggle(item.id);
  };

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        disabled={pending && !selection.mode}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          pressed && !pending && { transform: [{ scale: 0.99 }], opacity: 0.97 },
        ]}
        className={`flex-row gap-3 px-4 py-3 border-b border-border ${
          pending ? 'opacity-70' : ''
        } ${errored && !selected ? 'border-l-4 border-l-danger' : ''} ${
          selected ? 'bg-accent/10 border-l-4 border-l-accent' : ''
        }`}
      >
        {selection.mode ? (
          <View
            className={`w-6 h-6 rounded-full items-center justify-center border-2 self-center ${
              selected ? 'bg-accent border-accent' : 'border-border bg-card'
            }`}
          >
            {selected ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
        ) : null}
        <Thumbnail item={item} className="w-24 h-24" rounded="md" />
        <View className="flex-1 gap-1">
          <Text
            className="text-base font-semibold text-fg"
            style={{ fontFamily: 'Inter_600SemiBold' }}
            numberOfLines={1}
          >
            {item.title ?? 'Untitled'}
          </Text>
          {item.summary ? (
            <Text className="text-sm text-muted" numberOfLines={2}>
              {item.summary}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-1">
            {item.category ? <Badge label={item.category} palette={item.category} /> : null}
            {(item.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} tone="accent" />
            ))}
            <Text className="text-xs text-muted ml-1">{relativeDate(item.created)}</Text>
          </View>
        </View>
        {pending ? <Spinner tint="muted" /> : null}
      </Pressable>
    </Animated.View>
  );
};
