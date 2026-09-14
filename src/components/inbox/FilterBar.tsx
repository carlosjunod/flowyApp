import React from 'react';
import { LabelSection } from './LabelSection';
import { Feather } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Props = {
  unread?: boolean;
  onUnreadChange?: (value: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  tag: string | null;
  onTagChange: (tag: string | null) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
};

export const FilterBar: React.FC<Props> = ({
  unread, onUnreadChange,
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
      <LabelSection category={category} onCategory={onCategoryChange} tag={tag} onTag={onTagChange} />
      <View className="flex-row">
        {onUnreadChange ? <Pressable accessibilityRole="button" accessibilityState={{ selected: !!unread }}
          onPress={() => onUnreadChange(!unread)} className={`px-3.5 h-11 rounded-full items-center justify-center ${unread ? 'bg-fg' : 'bg-card border border-border'}`}>
          <Text className={unread ? 'text-bg' : 'text-fg'}>Unread</Text>
        </Pressable> : null}
      </View>
    </View>
  );
};
