import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  category: string | null;
  onCategoryChange: (category: string | null) => void;
};

export const FilterBar: React.FC<Props> = ({
  search,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
}) => {
  const colors = useResolvedColors();
  return (
    <View className="bg-bg px-4 pt-3 pb-1 gap-2">
      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search"
        placeholderTextColor={colors.muted}
        className="h-10 rounded-xl border border-border bg-card px-3 text-fg"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        <Pressable
          onPress={() => onCategoryChange(null)}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          className={`px-3.5 h-8 rounded-full items-center justify-center ${
            category === null ? 'bg-fg' : 'bg-card border border-border'
          }`}
        >
          <Text
            className={category === null ? 'text-bg' : 'text-fg'}
            style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
          >
            All
          </Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c}
            onPress={() => onCategoryChange(c)}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            className={`px-3.5 h-8 rounded-full items-center justify-center ${
              category === c ? 'bg-fg' : 'bg-card border border-border'
            }`}
          >
            <Text
              className={category === c ? 'text-bg' : 'text-fg'}
              style={{ fontFamily: 'Inter_500Medium', fontSize: 13 }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};
