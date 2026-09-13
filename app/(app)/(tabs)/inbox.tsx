import { useAdaptivePane } from '@/components/navigation/AdaptiveTabs';
import { inboxCardColumns, inboxColumns } from '@/lib/adaptiveLayout';
import { AppIcon } from '@/components/ui/AppIcon';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
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

import { PersonalizationInvitation } from '@/components/personalization/PersonalizationInvitation';
import { DigestInvitation } from '@/components/digest/DigestInvitation';
import { BulkImportSheet } from '@/components/inbox/BulkImportSheet';
import { FilterBar } from '@/components/inbox/FilterBar';
import { ItemCard } from '@/components/inbox/ItemCard';
import { ItemRow } from '@/components/inbox/ItemRow';
import { SelectionActionBar } from '@/components/inbox/SelectionActionBar';
import { Shimmer } from '@/components/ui/Shimmer';
import { useReducedMotion } from 'react-native-reanimated';
import { ViewModeToggle } from '@/components/inbox/ViewModeToggle';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSelection } from '@/lib/selection';
import {
  flattenPages,
  useDebounced,
  useItems,
} from '@/hooks/useItems';
import { useAuth } from '@/lib/auth';
import { pb } from '@/lib/pb';
import { useResolvedColors } from '@/lib/theme';
import { useViewMode } from '@/lib/viewMode';
import type { Item, ViewMode } from '@/types';

export default function InboxScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { fontScale } = useWindowDimensions();
  const { width, split, visible: paneVisible, selectedItemId, onOpenItem } = useAdaptivePane();
  const colors = useResolvedColors();
  const selection = useSelection();
  const [viewMode, setViewMode] = useViewMode();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'working' | 'done'>('idle');
  const reducedMotion = useReducedMotion();

  const onViewModeChange = useCallback(
    (next: ViewMode) => {
      if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode(next);
    },
    [setViewMode, reducedMotion],
  );

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 200);
  const [unread, setUnread] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const query = useItems({
    userId: user?.id ?? null,
    sortField: 'created',
    sortDir: 'desc',
    search, category, unread,
  });

  const items = useMemo(() => flattenPages(query.data), [query.data]);
  const categories = query.data?.pages[0]?.categories ?? [];
  const visible = items;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const invalidate = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: ['items', user.id] });
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
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') invalidate(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') invalidate(); }, 30_000);
    return () => {
      foreground.remove();
      clearInterval(timer);
      cancelled = true;
      unsub?.();
    };
  }, [user?.id, queryClient]);

  const onRefresh = () => query.refetch();

  const columns = viewMode === 'grid'
    ? inboxCardColumns(width, fontScale, split)
    : inboxColumns(width, fontScale);


  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <PersonalizationInvitation />
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
          <Pressable onPress={() => selection.mode ? selection.exit() : selection.enter()} accessibilityRole="button" accessibilityLabel={selection.mode ? 'Cancel selection' : 'Select items'} className="h-11 justify-center px-2"><Text className="text-fg text-sm">{selection.mode ? 'Cancel' : 'Select'}</Text></Pressable>
          <Pressable onPress={() => setBulkOpen(true)} accessibilityRole="button" accessibilityLabel="Save a link" className="h-11 rounded-full bg-primary px-4 justify-center"><Text className="text-bg font-semibold">{captureStatus === 'working' ? 'Saving…' : captureStatus === 'done' ? 'Saved' : 'Save'}</Text></Pressable>
        </View>
      </View>
      {user && items.length > 0 ? <DigestInvitation key={user.id} userId={user.id} /> : null}
      <BulkImportSheet onStatusChange={setCaptureStatus} visible={bulkOpen && paneVisible} onClose={() => setBulkOpen(false)} />
      <FilterBar
        unread={unread}
        onUnreadChange={setUnread}
        search={searchInput}
        onSearchChange={setSearchInput}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
      />
      {unread ? <Text className="text-xs text-muted px-4 pt-1">Items without a read mark, including older saves with no recorded reading state.</Text> : null}
      {query.isError ? <View className="px-4 py-3 flex-row items-center gap-2"><Text accessibilityRole="alert" className="text-danger flex-1 text-sm">Your inbox could not be loaded. Check your connection and try again.</Text><Button title="Retry" variant="secondary" onPress={() => { void query.refetch(); }} /></View> : null}
      {query.isLoading ? <View accessibilityLabel="Loading saved content" className="px-4 gap-3 pt-3">{[1, 2, 3].map(n => <View key={n} className="h-20 bg-surface rounded-xl overflow-hidden relative"><Shimmer /></View>)}</View> : null}
      {!query.isLoading && !query.isError ? <Text className="text-xs text-muted px-4 pt-2">{query.data?.pages[0]?.totalItems ?? 0} {search || category || unread ? 'results' : 'saved items'}</Text> : null}
      {viewMode === 'grid' || columns > 1 ? (
        <FlatList
          key={`${viewMode}-${columns}`}
          data={visible}
          keyExtractor={(it) => it.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: 12, paddingHorizontal: 16 } : undefined}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: selection.mode ? 116 : 24,
            gap: columns === 1 ? 16 : 12,
          }}
          refreshing={query.isRefetching}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <View
              style={
                columns > 1
                  ? { flex: 1 / columns }
                  : { paddingHorizontal: 16 }
              }
            >
              {viewMode === 'grid' ? <ItemCard item={item} onOpen={onOpenItem} active={item.id === selectedItemId} /> : <ItemRow item={item} inColumn onOpen={onOpenItem} active={item.id === selectedItemId} />}
            </View>
          )}
          ListEmptyComponent={query.isLoading || query.isError ? null :
            <EmptyState
              onSave={() => setBulkOpen(true)}
              hasFilters={!!search || !!category || unread}
              search={search}
              category={category}
              onClearFilters={() => {
                setSearchInput('');
                setCategory(null);
                setUnread(false);
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
          contentContainerStyle={{ paddingTop: 8, paddingBottom: selection.mode ? 116 : 24 }}
          refreshing={query.isRefetching}
          onRefresh={onRefresh}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <SectionHeader label={item.label} count={item.count} />
            ) : (
              <ItemRow item={item.item} onOpen={onOpenItem} active={item.item.id === selectedItemId} />
            )
          }
          ListEmptyComponent={query.isLoading || query.isError ? null :
            <EmptyState
              onSave={() => setBulkOpen(true)}
              hasFilters={!!search || !!category || unread}
              search={search}
              category={category}
              onClearFilters={() => {
                setSearchInput('');
                setCategory(null);
                setUnread(false);
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
  onSave: () => void;
}> = ({ hasFilters, search, category, onClearFilters, onSave }) => {
  if (hasFilters) {
    const what = search
      ? `“${search}”`
      : category
        ? `the ${category} category`
        : 'your filters';
    return (
      <View className="items-center justify-center px-6 pt-16">
        <View className="mb-3"><AppIcon name="search" size={40} /></View>
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
      <View className="mb-3"><AppIcon name="inbox" size={40} /></View>
      <Text className="text-xl text-fg font-semibold mb-2">Keep something worth revisiting</Text>
      <Text className="text-base text-muted text-center mb-5">Save a link here, or choose Share → Flowy from another app to save links, images and files.</Text>
      <Button title="Save your first link" onPress={onSave} />
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
