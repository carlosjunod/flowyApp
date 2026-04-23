import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/lib/api';
import { relativeDate } from '@/lib/relativeDate';
import type { Digest, DigestSection } from '@/types';

export default function DigestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery<Digest, Error>({
    queryKey: ['digest', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error('No digest id');
      const res = await api.getDigest(id);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
      </SafeAreaView>
    );
  }
  if (query.error || !query.data) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-base text-danger mb-4">
          {query.error?.message ?? 'Digest not found'}
        </Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const digest = query.data;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-accent text-base">← Back</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>
        <View className="gap-1">
          <Text className="text-xs uppercase text-muted">
            {relativeDate(digest.generated_at)}
          </Text>
          <Text
            className="text-3xl text-fg"
            style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.5 }}
          >
            Your digest
          </Text>
          <Text className="text-sm text-muted">
            {digest.items_count} {digest.items_count === 1 ? 'item' : 'items'} across{' '}
            {digest.categories_count} {digest.categories_count === 1 ? 'category' : 'categories'}
          </Text>
        </View>
        {digest.content.sections.map((section, i) => (
          <SectionCard key={`${section.category}-${i}`} section={section} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionCard: React.FC<{ section: DigestSection }> = ({ section }) => (
  <View className="rounded-2xl border border-border bg-card p-4 gap-3">
    <Text
      className="text-xl text-fg"
      style={{ fontFamily: 'InstrumentSerif_400Regular', letterSpacing: -0.3 }}
    >
      {section.category}
    </Text>
    <Text className="text-base text-fg leading-6">{section.summary}</Text>
    {section.image_urls.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {section.image_urls.map((url, i) => (
          <Image
            key={`${url}-${i}`}
            source={{ uri: url }}
            style={{ width: 88, height: 88, borderRadius: 8 }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
    ) : null}
    {section.item_ids.length > 0 ? (
      <View className="flex-row flex-wrap gap-2 pt-1">
        {section.item_ids.map((id) => (
          <Pressable
            key={id}
            onPress={() => router.push(`/item/${id}`)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            className="px-3 py-1.5 rounded-full bg-surface border border-border"
          >
            <Text className="text-xs text-fg">Open item</Text>
          </Pressable>
        ))}
      </View>
    ) : null}
  </View>
);
