import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { SortDir, SortField } from '@/types';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortDir: SortDir;
  onSortDirChange: (dir: SortDir) => void;
  categories: string[];
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
};

const sortFields: { key: SortField; label: string }[] = [
  { key: 'created', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'type', label: 'Type' },
];

export const FilterBar: React.FC<Props> = ({
  search,
  onSearchChange,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
  categories,
  category,
  onCategoryChange,
  selectionMode = false,
  onToggleSelectionMode,
}) => {
  const colors = useResolvedColors();
  return (
    <View className="border-b border-border bg-bg px-4 pt-3 pb-2 gap-2">
      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search"
        placeholderTextColor={colors.muted}
        className="h-10 rounded-xl border border-border bg-card px-3 text-fg"
      />
      <View className="flex-row items-center justify-between">
        <View className="flex-row rounded-xl border border-border overflow-hidden">
            {sortFields.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => onSortFieldChange(s.key)}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                className={`px-3 h-9 items-center justify-center ${
                  sortField === s.key ? 'bg-primary' : 'bg-card'
                }`}
              >
                <Text className={sortField === s.key ? 'text-bg' : 'text-muted'}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => onSortDirChange(sortDir === 'asc' ? 'desc' : 'asc')}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            className="h-9 w-9 rounded-xl border border-border bg-card items-center justify-center"
          >
            <Text className="text-fg">{sortDir === 'asc' ? '↑' : '↓'}</Text>
          </Pressable>
          {onToggleSelectionMode ? (
            <Pressable
              onPress={onToggleSelectionMode}
              accessibilityLabel={selectionMode ? 'Exit selection' : 'Enter selection'}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              className={`h-9 px-3 rounded-xl border items-center justify-center flex-row gap-1 ${
                selectionMode ? 'bg-accent border-accent' : 'border-border bg-card'
              }`}
            >
              <Feather
                name={selectionMode ? 'x' : 'check-square'}
                size={14}
                color={selectionMode ? '#fff' : colors.fg}
              />
              <Text
                className={`text-xs font-medium ${selectionMode ? 'text-white' : 'text-fg'}`}
              >
                {selectionMode ? 'Done' : 'Select'}
              </Text>
            </Pressable>
          ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        <Pressable
          onPress={() => onCategoryChange(null)}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          className={`px-3 h-8 rounded-full items-center justify-center ${
            category === null ? 'bg-accent' : 'bg-card border border-border'
          }`}
        >
          <Text className={category === null ? 'text-white' : 'text-fg'}>All</Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable
            key={c}
            onPress={() => onCategoryChange(c)}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            className={`px-3 h-8 rounded-full items-center justify-center ${
              category === c ? 'bg-accent' : 'bg-card border border-border'
            }`}
          >
            <Text className={category === c ? 'text-white' : 'text-fg'}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};
