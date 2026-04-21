import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

import { thumbnailFor } from '@/lib/thumbnails';
import type { Item } from '@/types';

type Props = {
  item: Item;
  className?: string;
  rounded?: 'sm' | 'md' | 'lg';
};

const roundedMap = { sm: 'rounded-md', md: 'rounded-lg', lg: 'rounded-xl' };

export const Thumbnail: React.FC<Props> = ({ item, className, rounded = 'md' }) => {
  const thumb = thumbnailFor(item);
  const shape = roundedMap[rounded];
  if (thumb.kind === 'image') {
    return (
      <Image
        source={{ uri: thumb.uri }}
        className={`${shape} bg-card ${className ?? ''}`}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View className={`${shape} bg-card items-center justify-center ${className ?? ''}`}>
      <Text className="text-3xl">{thumb.glyph}</Text>
    </View>
  );
};
