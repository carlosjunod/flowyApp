import React from 'react';
import { Text, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';
import type { SourceChip as SourceChipData } from '@/lib/sourceChip';

/**
 * Pill that surfaces the item's content type in the detail meta header.
 * Three variants: default (subtle), dark (YouTube-red), green (receipts).
 */
export const SourceChip: React.FC<{ chip: SourceChipData }> = ({ chip }) => {
  const colors = useResolvedColors();

  let bg: string = colors.surface;
  let fg: string = colors.fg;
  let borderColor: string | null = colors.border;

  if (chip.variant === 'dark') {
    bg = '#1A1815';
    fg = '#FFFFFF';
    borderColor = null;
  } else if (chip.variant === 'green') {
    bg = colors.success + '1A';
    fg = colors.success;
    borderColor = colors.success + '4D';
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: borderColor ? 1 : 0,
        borderColor: borderColor ?? 'transparent',
      }}
    >
      <Text style={{ fontSize: 11 }}>{chip.icon}</Text>
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10.5,
          color: fg,
        }}
      >
        {chip.label}
      </Text>
    </View>
  );
};
