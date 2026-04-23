import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BulkImportSheet } from '@/components/inbox/BulkImportSheet';
import { FilterBar } from '@/components/inbox/FilterBar';
import { ItemCard } from '@/components/inbox/ItemCard';
import { ItemDetailRow } from '@/components/inbox/ItemDetailRow';
import { ItemRow } from '@/components/inbox/ItemRow';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  extractCategories,
  flattenPages,
  useDebounced,
  useFilteredSearchedItems,
  useItems,
} from '@/hooks/useItems';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { useResolvedColors } from '@/lib/theme';
import { useViewMode } from '@/lib/viewMode';
import type { Item, SortDir, SortField } from '@/types';

const columnsFor = (width: number): number => {
  if (width >= 1024) return 4;
  if (width >= 640) return 3;
  return 2;
};

export default function InboxScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const colors = useResolvedColors();
  const [viewMode, setViewMode] = useViewMode();
  const [bulkOpen, setBulkOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 200);
  const [sortField, setSortField] = useState<SortField>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [category, setCategory] = useState<string | null>(null);

  const query = useItems({
    userId: user?.id ?? null,
    sortField,
    sortDir,
  });

  const items = useMemo(() => flattenPages(query.data), [query.data]);
  const categories = useMemo(() => extractCategories(items), [items]);
  const visible = useFilteredSearchedItems(items, search, category);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const invalidate = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: ['items'] });
    };
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const fn = await pb
          .collection('items')
          .subscribe<Item>('*', (ev) => {
            if (ev.record?.user === user.id) invalidate();
          });
        if (cancelled) fn();
        else unsub = fn;
      } catch {
        // fall back to normal refetch
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user?.id, queryClient]);

  const onRefresh = () => query.refetch();

  const columns = viewMode === 'grid' ? columnsFor(width) : 1;

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Inbox
        </Text>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setBulkOpen(true)}
            hitSlop={8}
            accessibilityLabel="Bulk import links"
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Feather name="plus" size={20} color={colors.fg} />
          </Pressable>
          <ThemeToggle />
        </View>
      </View>
      <BulkImportSheet visible={bulkOpen} onClose={() => setBulkOpen(false)} />
      <FilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDir={sortDir}
        onSortDirChange={setSortDir}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
      />
      <FlatList
        key={`${viewMode}-${columns}`}
        data={visible}
        keyExtractor={(it) => it.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingVertical: 12, gap: viewMode === 'grid' ? 12 : 0 }}
        refreshing={query.isRefetching}
        onRefresh={onRefresh}
        renderItem={({ item }) => {
          if (viewMode === 'grid') {
            return (
              <View style={{ flex: 1 / columns }}>
                <ItemCard item={item} />
              </View>
            );
          }
          if (viewMode === 'list') return <ItemRow item={item} />;
          return <ItemDetailRow item={item} />;
        }}
        ListEmptyComponent={
          <View className="items-center justify-center px-6 pt-16">
            <Text className="text-5xl mb-3">{search ? '🔍' : '📥'}</Text>
            <Text className="text-base text-muted">
              {search ? 'No items match your search' : 'Nothing saved yet'}
            </Text>
          </View>
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <View className="p-4">
              <Button
                title={query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                variant="secondary"
                loading={query.isFetchingNextPage}
                onPress={() => query.fetchNextPage()}
              />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
