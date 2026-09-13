import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

export function ReadingIndicator({ item }: { item: Item }) {
  const colors = useResolvedColors();
  return <View accessibilityLabel={item.read_at ? 'Marked as read' : 'No read mark recorded'} className="items-center justify-center w-5 h-5">
    {item.read_at ? <Feather name="check" size={15} color={colors.muted} /> : <View className="w-1.5 h-1.5 rounded-full bg-muted" />}
  </View>;
}
