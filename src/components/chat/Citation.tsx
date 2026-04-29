import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { hostOf } from '@/lib/thumbnails';

type Props = {
  index: number;
  itemId: string;
  sourceUrl?: string;
};

const stripWww = (h: string) => h.replace(/^www\./, '');

export const Citation: React.FC<Props> = ({ index, itemId, sourceUrl }) => {
  const host = sourceUrl ? hostOf(sourceUrl) : null;
  const label = host ? stripWww(host) : null;
  return (
    <Pressable
      onPress={() => router.push(`/item/${itemId}`)}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <View className="flex-row items-center gap-1 self-start rounded-full bg-accent px-2.5 py-1">
        <Text
          className="text-white"
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11 }}
        >
          [{index}]
        </Text>
        {label ? (
          <Text
            className="text-white"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 11 }}
            numberOfLines={1}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};
