import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useChatSources } from '@/hooks/useChatSources';
import { useI18n } from '@/lib/i18n';
import { ItemRow } from './ItemRow';
import { Button } from '@/components/ui/Button';
import { Shimmer } from '@/components/ui/Shimmer';

export function ChatSourceResults({ userId, ids, onClose, onOpenItem }: {
  userId?: string; ids: string[]; onClose: () => void; onOpenItem?: (id: string) => void;
}) {
  const { t } = useI18n();
  const query = useChatSources(userId, ids);
  return <View style={{ flex: 1 }}>
    <View className="px-4 py-2 flex-row items-center justify-between border-b border-border">
      <Text accessibilityRole="header" className="text-fg font-semibold" style={{ flex: 1 }}>{t('chat.inboxChat.results', { count: ids.length })}</Text>
      <Button title={t('chat.inboxChat.backToInbox')} variant="ghost" onPress={onClose} />
    </View>
    {query.isPending ? <View className="m-4 h-20 rounded-xl overflow-hidden bg-surface"><Shimmer /></View> : query.isError ? <View className="p-4 gap-3"><Text accessibilityRole="alert" className="text-danger">{t('chat.inboxChat.sourcesLoadFailed')}</Text><Button title={t('chat.inboxChat.retry')} onPress={() => void query.refetch()} /></View> : <>
      <Text accessibilityLiveRegion="polite" className="px-4 py-3 text-sm text-muted">{t('chat.inboxChat.sourcesAvailable', { count: query.data.length, total: ids.length })}</Text>
      <FlatList data={query.data} keyExtractor={item => item.id} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={{ paddingBottom: 88 }}
        renderItem={({ item }) => <ItemRow item={item} onOpen={onOpenItem} />}
        ListEmptyComponent={<Text className="p-4 text-muted">{t('chat.inboxChat.sourcesEmpty')}</Text>} />
    </>}
  </View>;
}
