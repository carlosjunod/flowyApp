import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useChatSources } from '@/hooks/useChatSources';
import { ItemRow } from './ItemRow';
import { Button } from '@/components/ui/Button';
import { Shimmer } from '@/components/ui/Shimmer';

export function ChatSourceResults({ userId, ids, onClose, onOpenItem }: {
  userId?: string; ids: string[]; onClose: () => void; onOpenItem?: (id: string) => void;
}) {
  const query = useChatSources(userId, ids);
  return <View style={{ flex: 1 }}>
    <View className="px-4 py-2 flex-row items-center justify-between border-b border-border">
      <Text accessibilityRole="header" className="text-fg font-semibold" style={{ flex: 1 }}>Chat results · {ids.length}</Text>
      <Button title="Back to inbox" variant="ghost" onPress={onClose} />
    </View>
    {query.isPending ? <View className="m-4 h-20 rounded-xl overflow-hidden bg-surface"><Shimmer /></View> : query.isError ? <View className="p-4 gap-3"><Text accessibilityRole="alert" className="text-danger">Could not load these sources. Check your connection and try again.</Text><Button title="Retry" onPress={() => void query.refetch()} /></View> : <>
      <Text accessibilityLiveRegion="polite" className="px-4 py-3 text-sm text-muted">{query.data.length} of {ids.length} sources available. Your other inbox filters are paused.</Text>
      <FlatList data={query.data} keyExtractor={item => item.id} refreshing={query.isRefetching} onRefresh={() => void query.refetch()} contentContainerStyle={{ paddingBottom: 88 }}
        renderItem={({ item }) => <ItemRow item={item} onOpen={onOpenItem} />}
        ListEmptyComponent={<Text className="p-4 text-muted">These sources are no longer available in your library. Return to your inbox or try another response.</Text>} />
    </>}
  </View>;
}
