import { AppIcon } from '@/components/ui/AppIcon';
import React from 'react';
import { Text, View } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { SourceChip as SourceChipData } from '@/lib/sourceChip';

/**
 * Resolve a chip to display text.
 *
 * `labelText` carries source-provided content (a publisher's `site_name`) and
 * always wins over the translated fallback — a publisher's name is content,
 * not interface copy. Exported so the reader can reuse the same rule in its
 * "Tags and details" line without duplicating the precedence.
 */
export function useSourceChipLabel(chip: SourceChipData): string {
  const { tKey } = useI18n();
  return chip.labelText?.trim() || tKey(chip.labelKey, chip.labelVars);
}

/**
 * Pill that surfaces the item's content type in the detail meta header.
 * Three variants: default (subtle), dark (YouTube-red), green (receipts).
 */
export const SourceChip: React.FC<{ chip: SourceChipData }> = ({ chip }) => {
  const colors = useResolvedColors();
  const label = useSourceChipLabel(chip);

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
      <AppIcon name={chip.icon} size={12} color={fg} />
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10.5,
          color: fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
};
