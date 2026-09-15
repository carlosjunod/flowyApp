import { useEffect, useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { pb } from '@/lib/pb';
import { useResolvedColors } from '@/lib/theme';
import { formatFileBytes, type StorageFiles } from '@/types/files';
import type { ApiResult } from '@/types';
import { FileRetentionPicker } from './FileRetentionPicker';
import { StorageAction } from './StorageAction';
import { StorageFileRow } from './StorageFileRow';

const SORT_OPTIONS = [
  { value: 'largest', label: 'Largest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
];
export function StorageManager({ onChanged }: { onChanged: () => void }) {
  const colors = useResolvedColors(),
    router = useRouter();
  const [data, setData] = useState<StorageFiles | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [sort, setSort] = useState('largest'),
    [duplicates, setDuplicates] = useState(false),
    [sorting, setSorting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let cancelled = false;
    const token = pb.authStore.token;
    setLoading(true);
    setError('');
    void api
      .storageFiles({ page, search: query, sort, duplicates })
      .then((r) => {
        if (cancelled || token !== pb.authStore.token) return;
        if (r.error) setError('Could not load stored files. Please try again.');
        else {
          setData(r.data);
          if (page > r.data.totalPages && page > 1)
            setPage(Math.max(1, r.data.totalPages));
        }
      })
      .catch(() => {
        if (!cancelled && token === pb.authStore.token)
          setError('Could not load stored files. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, query, sort, duplicates, version]);
  async function change(
    action: () => Promise<ApiResult<unknown>>,
    removed = false,
  ): Promise<boolean> {
    const token = pb.authStore.token;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await action();
      if (token !== pb.authStore.token) return false;
      if (r.error) {
        setError(
          r.error.code === 'ORIGINAL_REQUIRED'
            ? 'Keep this original until extraction finishes and the item is ready.'
            : 'Could not update files. Please try again.',
        );
        return false;
      }
      setVersion((v) => v + 1);
      onChanged();
      setNotice(
        removed
          ? 'Original scheduled for removal. Your extracted text is kept.'
          : 'Retention preference saved.',
      );
      return true;
    } catch {
      setError('Could not update files. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    const token = pb.authStore.token;
    setBusy(true);
    setError('');
    try {
      const r = await api.downloadOriginal(id);
      if (token !== pb.authStore.token) return;
      if (r.error) setError('Could not download original.');
      else await Linking.openURL(r.data.url);
    } catch {
      if (token === pb.authStore.token) setError('Could not open original.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      {data ? (
        <FileRetentionPicker
          value={data.retention}
          disabled={busy}
          onSave={(v) => change(() => api.storagePreference(v))}
        />
      ) : null}
      <View className="mt-4 mb-1 flex-row items-center justify-between">
        <Text
          accessibilityRole="header"
          className="font-sans text-base font-semibold text-fg"
        >
          Your files
          {data ? (
            <Text className="font-normal text-muted"> {data.totalFiles}</Text>
          ) : null}
        </Text>
        <StorageAction
          label="Refresh files"
          icon="refresh-cw"
          disabled={loading}
          onPress={() => setVersion((v) => v + 1)}
        />
      </View>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row rounded-lg bg-surface p-1">
          <StorageAction
            title="All files"
            selected={!duplicates}
            onPress={() => {
              setDuplicates(false);
              setPage(1);
            }}
          />
          <StorageAction
            title="Duplicates"
            selected={duplicates}
            onPress={() => {
              setDuplicates(true);
              setPage(1);
            }}
          />
        </View>
        <StorageAction
          title={SORT_OPTIONS.find((o) => o.value === sort)?.label}
          label="Sort files"
          icon="chevron-down"
          expanded={sorting}
          onPress={() => setSorting((v) => !v)}
        />
      </View>
      {sorting ? (
        <View className="my-2 border-y border-border py-1">
          {SORT_OPTIONS.map((o) => (
            <StorageAction
              key={o.value}
              title={o.label}
              selected={sort === o.value}
              onPress={() => {
                setSort(o.value);
                setPage(1);
                setSorting(false);
              }}
            />
          ))}
        </View>
      ) : null}
      <View className="my-4 min-h-[44px] flex-row items-center rounded-lg border border-border pl-3">
        <Feather
          accessible={false}
          name="search"
          size={17}
          color={colors.muted}
        />
        <TextInput
          accessibilityLabel="Search files"
          placeholder="Search by filename"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          returnKeyType="search"
          className="min-h-[44px] flex-1 px-3 font-sans text-sm text-fg"
        />
        {search ? (
          <StorageAction
            label="Clear file search"
            icon="x"
            onPress={() => setSearch('')}
          />
        ) : null}
      </View>
      {duplicates ? (
        <Text className="mb-4 font-sans text-[13px] leading-5 text-muted">
          {data && data.duplicateBytes > 0
            ? `${formatFileBytes(data.duplicateBytes)} in extra identical copies. `
            : ''}
          Same contents, even with different names. Each copy counts until you
          remove its original.
        </Text>
      ) : null}
      {error ? (
        <View className="mb-3 rounded-lg border border-border p-3">
          <Text accessibilityRole="alert" className="font-sans text-sm text-fg">
            {error}
          </Text>
          <StorageAction
            title="Retry"
            tone="action"
            onPress={() => setVersion((v) => v + 1)}
          />
        </View>
      ) : null}
      {notice ? (
        <View className="mb-3 flex-row items-center rounded-lg bg-surface pl-3">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 font-sans text-sm text-fg"
          >
            {notice}
          </Text>
          <StorageAction
            label="Dismiss file update"
            icon="x"
            onPress={() => setNotice('')}
          />
        </View>
      ) : null}
      {!data && loading ? (
        <View accessibilityLabel="Loading files" className="gap-5 py-4">
          {[1, 2, 3].map((n) => (
            <View key={n} className="flex-row gap-3">
              <View className="h-11 w-10 rounded bg-surface" />
              <View className="flex-1 gap-3">
                <View className="h-4 w-3/4 rounded bg-surface" />
                <View className="h-3 w-1/2 rounded bg-surface" />
              </View>
            </View>
          ))}
        </View>
      ) : data ? (
        <View
          accessibilityState={{ busy: loading }}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {data.files.length ? (
            <View className="border-t border-border">
              {data.files.map((file) => (
                <StorageFileRow
                  key={file.id}
                  file={file}
                  busy={busy || loading}
                  onDownload={() => void download(file.id)}
                  onRemove={() =>
                    change(() => api.removeOriginal(file.id), true)
                  }
                  onRetention={(v) =>
                    change(() => api.fileRetention(file.id, v))
                  }
                />
              ))}
            </View>
          ) : (
            <View className="items-center border-y border-border px-4 py-10">
              <Feather name="file-text" size={28} color={colors.muted} />
              <Text className="mt-4 text-center font-sans text-sm font-semibold text-fg">
                {query
                  ? 'No matching files'
                  : duplicates
                    ? 'No duplicate originals'
                    : 'Your originals will appear here'}
              </Text>
              <Text className="mt-2 text-center font-sans text-sm leading-5 text-muted">
                {query
                  ? 'Try another filename or clear your search.'
                  : duplicates
                    ? 'New files are checked after upload. There is nothing to remove here.'
                    : 'Save a document from your inbox or share it to Flowy.'}
              </Text>
              {query ? (
                <StorageAction
                  title="Clear search"
                  tone="action"
                  onPress={() => setSearch('')}
                />
              ) : !duplicates ? (
                <StorageAction
                  title="Go to inbox"
                  tone="action"
                  onPress={() => router.push('/inbox')}
                />
              ) : null}
            </View>
          )}
          {data.totalPages > 1 ? (
            <View className="mt-3 flex-row items-center justify-between">
              <StorageAction
                title="Previous"
                disabled={page <= 1 || loading}
                onPress={() => setPage((v) => v - 1)}
              />
              <Text className="font-sans text-[13px] text-muted">
                Page {page} of {data.totalPages}
              </Text>
              <StorageAction
                title="Next"
                disabled={page >= data.totalPages || loading}
                onPress={() => setPage((v) => v + 1)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
