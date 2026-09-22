import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { ViewMode } from '@/types';

type Props = { value: ViewMode; onChange: (mode: ViewMode) => void };
const views = [
  { value: 'grid', labelKey: 'inbox.filters.viewCards', icon: 'grid' },
  { value: 'list', labelKey: 'inbox.filters.viewList', icon: 'menu' },
  // Summary view temporarily hidden.
  // { value: 'detail', labelKey: 'inbox.filters.viewDetail', icon: 'align-left' }
] as const;

export function ViewModeToggle({ value, onChange }: Props) {
  const { t, tKey } = useI18n();
  const colors = useResolvedColors();
  return <View style={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 2, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      {views.map(view => {
        const label = tKey(view.labelKey);
        return <Pressable key={view.value} accessibilityRole="button" accessibilityLabel={t('inbox.filters.viewLabel', { view: label })} accessibilityState={{ selected: value === view.value }} onPress={() => onChange(view.value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, backgroundColor: value === view.value ? colors.fg : colors.card }}><Feather name={view.icon} size={16} color={value === view.value ? colors.bg : colors.muted} /><Text style={{ color: value === view.value ? colors.bg : colors.fg, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{label}</Text></Pressable>;
      })}
    </View>
  </View>;
}
