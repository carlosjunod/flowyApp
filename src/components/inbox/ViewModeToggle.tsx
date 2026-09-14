import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useResolvedColors } from '@/lib/theme';
import type { ViewMode } from '@/types';
import { CARD_SIZES, type CardSize } from '@/types/inbox-presentation';

type Props = { value: ViewMode; onChange: (mode: ViewMode) => void; cardSize: CardSize; onCardSize: (size: CardSize) => void };
const views = [{ value: 'grid', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'List', icon: 'menu' }, { value: 'detail', label: 'Summary', icon: 'align-left' }] as const;

export function ViewModeToggle({ value, onChange, cardSize, onCardSize }: Props) {
  const colors = useResolvedColors();
  return <View style={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {views.map(view => <Pressable key={view.value} accessibilityRole="button" accessibilityLabel={`${view.label} view`} accessibilityState={{ selected: value === view.value }} onPress={() => onChange(view.value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: value === view.value ? colors.fg : colors.card }}><Feather name={view.icon} size={16} color={value === view.value ? colors.bg : colors.muted} /><Text style={{ color: value === view.value ? colors.bg : colors.fg, fontSize: 13 }}>{view.label}</Text></Pressable>)}
    </View>
    {value === 'grid' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}><Text style={{ color: colors.muted, fontSize: 12, marginRight: 4 }}>Card size</Text>{CARD_SIZES.map(size => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`${size} cards`} accessibilityState={{ selected: cardSize === size }} onPress={() => onCardSize(size)} style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: cardSize === size ? colors.fg : colors.border, backgroundColor: colors.card }}><Text style={{ color: colors.fg, fontSize: 13, fontFamily: cardSize === size ? 'Inter_600SemiBold' : 'Inter_400Regular' }}>{size[0]!.toUpperCase() + size.slice(1)}</Text></Pressable>)}</View> : null}
  </View>;
}
