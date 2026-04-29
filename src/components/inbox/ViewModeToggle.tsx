import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { ViewMode } from '@/types';

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const SEGMENTS: { key: ViewMode; icon: 'grid' | 'list'; label: string }[] = [
  { key: 'grid', icon: 'grid', label: 'Grid view' },
  { key: 'list', icon: 'list', label: 'List view' },
];

export const ViewModeToggle: React.FC<Props> = ({ value, onChange }) => {
  const colors = useResolvedColors();
  return (
    <View
      className="flex-row items-center rounded-full border border-border overflow-hidden"
      style={{ height: 32 }}
      accessibilityRole="tablist"
    >
      {SEGMENTS.map((seg, i) => {
        const active = value === seg.key;
        return (
          <Pressable
            key={seg.key}
            accessibilityRole="tab"
            accessibilityLabel={seg.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(seg.key)}
            hitSlop={6}
            style={({ pressed }) => [
              {
                width: 36,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.fg : 'transparent',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: colors.border,
              },
              pressed && !active && { opacity: 0.6 },
            ]}
          >
            <Feather
              name={seg.icon === 'grid' ? 'grid' : 'menu'}
              size={15}
              color={active ? colors.bg : colors.muted}
            />
          </Pressable>
        );
      })}
    </View>
  );
};
