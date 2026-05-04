import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { ViewMode } from '@/types';

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export const ViewModeToggle: React.FC<Props> = ({ value, onChange }) => {
  const colors = useResolvedColors();
  const next: ViewMode = value === 'grid' ? 'list' : 'grid';
  const iconName: keyof typeof Feather.glyphMap = next === 'grid' ? 'grid' : 'menu';

  return (
    <Pressable
      onPress={() => onChange(next)}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${next} view`}
      accessibilityState={{ selected: value === next }}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      className="h-9 w-9 items-center justify-center rounded-full"
    >
      <Feather name={iconName} size={18} color={colors.fg} />
    </Pressable>
  );
};
