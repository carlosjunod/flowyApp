import React from 'react';
import type { ReadingFilter } from '@/types/inbox-presentation';
import { LabelSection } from './LabelSection';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Props = {
  reading?: ReadingFilter;
  onReadingChange?: (value: ReadingFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  tag: string | null;
  onTagChange: (tag: string | null) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
};

export const FilterBar: React.FC<Props> = ({
  reading, onReadingChange,
  search,
  onSearchChange,
  tag, onTagChange,
  category,
  onCategoryChange,
}) => {
  const colors = useResolvedColors();
  return (
    <View className="bg-bg px-4 pt-3 pb-1 gap-2">
      <View className="flex-row items-center rounded-xl border border-border bg-card">
      <TextInput accessibilityLabel="Search all saved content" returnKeyType="search" autoCorrect={false}
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search all saved content"
        placeholderTextColor={colors.muted}
        className="flex-1 h-11 px-3 text-fg"
      />
      {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" className="w-11 h-11 items-center justify-center" onPress={() => onSearchChange('')}><Feather name="x" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <LabelSection reading={reading} onReading={onReadingChange} category={category} onCategory={onCategoryChange} tag={tag} onTag={onTagChange} />

    </View>
  );
};
