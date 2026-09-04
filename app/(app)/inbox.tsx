import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { BulkImportSheet } from '@/components/inbox/BulkImportSheet';
import { FilterBar } from '@/components/inbox/FilterBar';
import { ItemCard } from '@/components/inbox/ItemCard';
import { ItemRow } from '@/components/inbox/ItemRow';
import { SelectionActionBar } from '@/components/inbox/SelectionActionBar';
import { SuggestionHeroCard } from '@/components/inbox/SuggestionHeroCard';
import { ViewModeToggle } from '@/components/inbox/ViewModeToggle';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSelection } from '@/lib/selection';
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
import type { Item, ViewMode } from '@/types';

const columnsFor = (width: number): number => {
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
};

export default function InboxScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const colors = useResolvedColors();
  const selection = useSelection();
  const [viewMode, setViewMode] = useViewMode();
  const [bulkOpen, setBulkOpen] = useState(false);

  const onViewModeChange = useCallback(
    (next: ViewMode) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode(next);
    },
    [setViewMode],
  );

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 200);
  const [category, setCategory] = useState<string | null>(null);

  const query = useItems({
    userId: user?.id ?? null,
    sortField: 'created',
    sortDir: 'desc',
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
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Inbox
        </Text>
        <View className="flex-row items-center gap-2">
          <ViewModeToggle
            value={viewMode === 'list' ? 'list' : 'grid'}
            onChange={onViewModeChange}
          />
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
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
      />
      {viewMode === 'grid' ? (
        <FlatList
          key={`grid-${columns}`}
          data={visible}
          keyExtractor={(it) => it.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 24,
            gap: columns === 1 ? 16 : 12,
          }}
          refreshing={query.isRefetching}
          onRefresh={onRefresh}
          ListHeaderComponent={
            visible.length > 0 ? (
              <SuggestionHeroCard items={visible} viewMode="grid" />
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={
                columns > 1
                  ? { flex: 1 / columns }
                  : { paddingHorizontal: 16 }
              }
            >
              <ItemCard item={item} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              hasFilters={!!search || !!category}
              search={search}
              category={category}
              onClearFilters={() => {
                setSearchInput('');
                setCategory(null);
              }}
            />
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
      ) : (
        <FlatList
          key="list"
          data={groupForList(visible)}
          keyExtractor={(row) =>
            row.kind === 'header' ? `h-${row.label}` : row.item.id
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          refreshing={query.isRefetching}
          onRefresh={onRefresh}
          ListHeaderComponent={
            visible.length > 0 ? (
              <SuggestionHeroCard items={visible} viewMode="list" />
            ) : null
          }
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <SectionHeader label={item.label} count={item.count} />
            ) : (
              <ItemRow item={item.item} />
            )
          }
          ListEmptyComponent={
            <EmptyState
              hasFilters={!!search || !!category}
              search={search}
              category={category}
              onClearFilters={() => {
                setSearchInput('');
                setCategory(null);
              }}
            />
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
      )}
      <SelectionActionBar />
    </SafeAreaView>
  );
}

type ListRow =
  | { kind: 'header'; label: string; count: number }
  | { kind: 'item'; item: Item };

// Distinguishes a filtered empty inbox (user search/category produced no
// matches) from a first-run empty inbox (no items at all). Web equivalent:
// apps/web/components/inbox/InboxGrid.tsx#EmptyState.
const EmptyState: React.FC<{
  hasFilters: boolean;
  search: string;
  category: string | null;
  onClearFilters: () => void;
}> = ({ hasFilters, search, category, onClearFilters }) => {
  if (hasFilters) {
    const what = search
      ? `“${search}”`
      : category
        ? `the ${category} category`
        : 'your filters';
    return (
      <View className="items-center justify-center px-6 pt-16">
        <Text className="text-5xl mb-3">🔍</Text>
        <Text className="text-base text-muted text-center mb-3">
          No items match {what}.
        </Text>
        <Pressable
          onPress={onClearFilters}
          hitSlop={6}
          accessibilityRole="button"
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        >
          <Text className="text-accent" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
            Clear filters
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View className="items-center justify-center px-6 pt-16">
      <Text className="text-5xl mb-3">📥</Text>
      <Text className="text-base text-muted">Nothing saved yet</Text>
    </View>
  );
};

const SectionHeader: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <View className="flex-row items-baseline justify-between px-4 pt-5 pb-2">
    <Text
      className="text-fg"
      style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1 }}
    >
      {label.toUpperCase()}
    </Text>
    <Text
      className="text-muted"
      style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
    >
      {count} {count === 1 ? 'item' : 'items'}
    </Text>
  </View>
);

const startOfDay = (d: Date): Date => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const groupForList = (items: Item[]): ListRow[] => {
  if (items.length === 0) return [];
  const now = startOfDay(new Date());
  const today = now.getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = today - 30 * 24 * 60 * 60 * 1000;

  const buckets: { label: string; cutoff: number; items: Item[] }[] = [
    { label: 'Today', cutoff: today, items: [] },
    { label: 'Yesterday', cutoff: yesterday, items: [] },
    { label: 'Earlier this week', cutoff: weekAgo, items: [] },
    { label: 'This month', cutoff: monthAgo, items: [] },
    { label: 'Older', cutoff: -Infinity, items: [] },
  ];

  const fallback = buckets[buckets.length - 1]!;
  for (const item of items) {
    const t = new Date(item.created).getTime();
    const placed = Number.isNaN(t) ? fallback : buckets.find((b) => t >= b.cutoff);
    (placed ?? fallback).items.push(item);
  }

  const rows: ListRow[] = [];
  for (const b of buckets) {
    if (b.items.length === 0) continue;
    rows.push({ kind: 'header', label: b.label, count: b.items.length });
    for (const item of b.items) rows.push({ kind: 'item', item });
  }
  return rows;
};
