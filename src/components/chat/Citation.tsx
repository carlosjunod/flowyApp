import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

type Props = {
  index: number;
  itemId: string;
};

export const Citation: React.FC<Props> = ({ index, itemId }) => (
  <Pressable
    onPress={() => router.push(`/item/${itemId}`)}
    className="inline-flex"
  >
    <Text className="text-accent font-semibold">[{index}]</Text>
  </Pressable>
);
