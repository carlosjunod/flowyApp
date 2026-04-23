import { useQuery } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relativeDate } from '@/lib/relativeDate';
import type { Digest } from '@/types';

export default function DigestListScreen() {
  const { user } = useAuth();
  const query = useQuery<Digest[], Error>({
    queryKey: ['digests', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await api.listDigests();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
        <Link href="/digest-settings" asChild>
          <Pressable hitSlop={8}>
            <Text className="text-accent text-base">Settings</Text>
          </Pressable>
        </Link>
      </View>
      <View className="px-4 pb-3">
        <Text
          className="text-3xl text-fg"
          style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
        >
          Daily digests
        </Text>
        <Text className="text-sm text-muted mt-1">A summary of what you saved each day.</Text>
      </View>

      {query.isLoading ? (
        <Spinner className="mt-12" size="large" />
      ) : query.error ? (
        <View className="px-6 pt-12 items-center">
          <Text className="text-danger">{query.error.message}</Text>
        </View>
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
          renderItem={({ item }) => <DigestRow digest={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center px-6 pt-16">
              <Text className="text-5xl mb-3">📰</Text>
              <Text className="text-base text-muted text-center">
                No digests yet. Once enabled, they generate daily at your chosen time.
              </Text>
            </View>
          }
          refreshing={query.isRefetching}
          onRefresh={() => query.refetch()}
        />
      )}
    </SafeAreaView>
  );
}

const DigestRow: React.FC<{ digest: Digest }> = ({ digest }) => (
  <Link href={`/digest/${digest.id}`} asChild>
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      className="rounded-xl border border-border bg-card p-4"
    >
      <Text className="text-xs uppercase text-muted">{relativeDate(digest.generated_at)}</Text>
      <Text
        className="text-lg text-fg mt-1"
        style={{ fontFamily: 'InstrumentSerif_400Regular' }}
      >
        {digest.categories_count} {digest.categories_count === 1 ? 'category' : 'categories'} ·{' '}
        {digest.items_count} {digest.items_count === 1 ? 'item' : 'items'}
      </Text>
    </Pressable>
  </Link>
);
