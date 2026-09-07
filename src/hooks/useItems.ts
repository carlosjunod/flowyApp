import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { api, type ItemsResponse } from '@/lib/api';
import { pb } from '@/lib/pb';
import type { Item, SortDir, SortField } from '@/types';

export const PAGE_SIZE = 20;

export type ItemsPage = ItemsResponse;

type ItemsParams = { sortField: SortField; sortDir: SortDir; userId: string | null; search?: string; category?: string | null };
export const normalizeCategory = (value?: string | null): string => { const key = value?.trim().toLowerCase() ?? ''; return key === 'tech' ? 'technology' : key; };

export const itemsQueryKey = (p: ItemsParams): readonly unknown[] =>
  ['items', p.userId, p.sortField, p.sortDir, p.search?.trim() ?? '', normalizeCategory(p.category)] as const;

export const useItems = (params: ItemsParams) => {
  return useInfiniteQuery<ItemsPage, Error, InfiniteData<ItemsPage>, readonly unknown[], number>({
    queryKey: itemsQueryKey(params),
    enabled: !!params.userId,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      if (!params.userId) throw new Error('No user');
      const result = await api.listItems({ page: pageParam, perPage: PAGE_SIZE,
        q: params.search?.trim(), category: normalizeCategory(params.category),
        sort: params.sortField === 'created' ? 'date' : params.sortField, direction: params.sortDir });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    getNextPageParam: (last) =>
      last.page * last.perPage < last.totalItems ? last.page + 1 : undefined,
  });
};

export const flattenPages = (data: InfiniteData<ItemsPage> | undefined): Item[] => {
  if (!data) return [];
  return data.pages.flatMap((p) => p.items);
};

export const extractCategories = (items: Item[]): string[] => {
  const seen = new Set<string>();
  for (const it of items) {
    if (it.category) seen.add(it.category);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
};

export const useItemById = (id: string | undefined) =>
  useQuery<Item, Error>({
    queryKey: ['item', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('No id');
      return pb.collection('items').getOne<Item>(id);
    },
  });

export const usePatchItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Pick<Item, 'title' | 'summary' | 'category' | 'tags'>>;
    }) => {
      const res = await api.patchItem(input.id, input.patch);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['item', input.id] });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useDeleteItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.deleteItem(id);
      if (res.error) throw new Error(res.error.message);
      return id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['item', id] });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useFilteredSearchedItems = (
  items: Item[],
  search: string,
  category: string | null,
): Item[] =>
  useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      const haystack = [
        it.title ?? '',
        it.summary ?? '',
        it.content ?? '',
        it.category ?? '',
        (it.tags ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, category]);

export const useDebounced = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};
