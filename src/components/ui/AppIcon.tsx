import { Feather } from '@expo/vector-icons';
import React from 'react';
import { useResolvedColors } from '@/lib/theme';
import { itemTypeIcon, type ItemIconName } from '@/lib/itemIcons';
import type { ItemType } from '@/types';

type Props = { size?: number; color?: string } & ({ name: ItemIconName; type?: never } | { type: ItemType; name?: never });

/** Decorative icon; its enclosing control or adjacent text provides the accessible label. */
export function AppIcon({ name, type, size = 20, color }: Props) {
  const colors = useResolvedColors();
  return <Feather name={name ?? (type ? itemTypeIcon[type] : 'file')} size={size} color={color ?? colors.muted} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
