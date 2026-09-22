import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

export function ReadingIndicator({ item, showLabel = false }: { item: Item; showLabel?: boolean }) {
  const { t } = useI18n();
  const colors = useResolvedColors();
  return <View accessibilityLabel={item.read_at ? t('inbox.read.markedRead') : t('inbox.read.noMark')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 }}>
    {item.read_at ? <Feather name="check" size={13} color={colors.muted} /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.unread }} />}
    {showLabel ? <Text style={{ fontSize: 12, color: colors.muted }}>{item.read_at ? t('inbox.read.read') : t('inbox.read.unread')}</Text> : null}
  </View>;
}
