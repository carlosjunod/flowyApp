import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

export function ReadingIndicator({ item, showLabel = false }: { item: Item; showLabel?: boolean }) {
  const colors = useResolvedColors();
  return <View accessibilityLabel={item.read_at ? 'Marked as read' : 'No read mark recorded'} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 }}>
    {item.read_at ? <Feather name="check" size={13} color={colors.muted} /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.unread }} />}
    {showLabel ? <Text style={{ fontSize: 12, color: colors.muted }}>{item.read_at ? 'Read' : 'Unread'}</Text> : null}
  </View>;
}
