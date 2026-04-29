import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaCarousel } from '@/components/inbox/MediaCarousel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useItemActions } from '@/hooks/useItemActions';
import { useDeleteItem, useItemById, usePatchItem } from '@/hooks/useItems';
import { useItemStatus } from '@/hooks/useItemStatus';
import { ENV } from '@/lib/env';
import { pb } from '@/lib/pb';
import { relativeDate } from '@/lib/relativeDate';
import { hostOf, thumbnailFor, typeGlyph } from '@/lib/thumbnails';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

const stripWww = (h: string) => h.replace(/^www\./, '');

const useRelatedItems = (item: Item | undefined) =>
  useQuery<Item[], Error>({
    queryKey: ['related', item?.id, item?.category],
    enabled: !!item?.id && !!item?.category,
    queryFn: async () => {
      if (!item?.id || !item?.category) return [];
      const escapedCat = item.category.replace(/"/g, '\\"');
      const res = await pb.collection('items').getList<Item>(1, 6, {
        filter: `category = "${escapedCat}" && id != "${item.id}"`,
        sort: '-created',
      });
      return res.items;
    },
  });

export default function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const { data: item, isLoading, error } = useItemById(id);
  useItemStatus(id);
  const { data: relatedItems = [] } = useRelatedItems(item);
  const { width } = useWindowDimensions();
  const colors = useResolvedColors();

  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
      </SafeAreaView>
    );
  }
  if (error || !item) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-base text-danger mb-4">
          {error?.message ?? 'Item not found'}
        </Text>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;

  const heroWidth = width - 32;
  const heroHeight = Math.round(heroWidth * 0.62);
  const heroThumb = thumbnailFor(item);
  const firstSlideUri = item.media && item.media.length > 0
    ? `${ENV.R2_PUBLIC_URL}/${item.media[0]!.r2_key}`
    : null;
  const heroUri = firstSlideUri
    ?? (heroThumb.kind === 'image' ? heroThumb.uri : null);
  const showCarousel = (item.media?.length ?? 0) > 1;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
          className="flex-row items-center gap-1.5"
        >
          <Feather name="chevron-left" size={20} color={colors.fg} />
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
          >
            Inbox
          </Text>
        </Pressable>
        <View className="flex-row gap-4">
          <ReloadButton item={item} />
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text className="text-fg" style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              Edit
            </Text>
          </Pressable>
          <DeleteButton id={item.id} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
        <View className="relative">
          <View
            className="bg-surface"
            style={{
              width: '100%',
              height: heroHeight,
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            {heroUri ? (
              <Image
                source={{ uri: heroUri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-6xl">{typeGlyph[item.type]}</Text>
              </View>
            )}
            {showCarousel ? (
              <View className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60">
                <Text
                  className="text-white"
                  style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11 }}
                >
                  1 / {item.media?.length ?? 1}
                </Text>
              </View>
            ) : null}
          </View>
          {domainLabel ? (
            <View
              className="absolute top-3 left-3 flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
            >
              {faviconUri ? (
                <Image
                  source={{ uri: faviconUri }}
                  style={{ width: 14, height: 14, borderRadius: 3 }}
                  contentFit="contain"
                />
              ) : null}
              <Text
                style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: '#1C1815' }}
                numberOfLines={1}
              >
                {domainLabel}
              </Text>
            </View>
          ) : null}
        </View>
        {showCarousel && item.media ? (
          <MediaCarousel slides={item.media} width={heroWidth} height={Math.round(heroHeight * 0.85)} />
        ) : null}

        <View className="gap-2.5">
          <Text
            className="text-fg"
            style={{
              fontFamily: 'InstrumentSerif_400Regular',
              fontSize: 32,
              lineHeight: 38,
              letterSpacing: -0.5,
            }}
          >
            {item.title ?? 'Untitled'}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            {item.category ? <Badge label={item.category} tone="accent" /> : null}
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              {relativeDate(item.created)}
            </Text>
            {item.status !== 'ready' ? (
              <Badge
                label={item.status}
                tone={item.status === 'error' ? 'danger' : 'neutral'}
              />
            ) : null}
          </View>
        </View>

        {item.source_url ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL(item.source_url ?? '')}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
            className="rounded-full bg-accent flex-row items-center justify-center gap-2"
            hitSlop={4}
          >
            <View className="flex-row items-center justify-center gap-2 py-3.5 px-5">
              <Feather name="external-link" size={16} color="#fff" />
              <Text
                className="text-white"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15 }}
              >
                Open original
              </Text>
            </View>
          </Pressable>
        ) : null}

        {item.summary ? (
          <View
            className="rounded-2xl border border-border bg-card px-4 py-4 gap-2"
            style={{ borderRadius: 18 }}
          >
            <View className="flex-row items-center gap-2">
              <View className="w-1.5 h-1.5 rounded-full bg-accent" />
              <Text
                className="text-muted"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 }}
              >
                FLOWY AI · TAKEAWAYS
              </Text>
            </View>
            <Text
              className="text-fg"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 }}
            >
              {item.summary}
            </Text>
          </View>
        ) : null}

        {item.error_msg ? (
          <View className="rounded-xl border border-danger bg-danger/10 p-3">
            <Text className="text-danger font-medium mb-1">Processing error</Text>
            <Text className="text-danger">{item.error_msg}</Text>
          </View>
        ) : null}

        {item.content ? (
          <View>
            <Markdown
              style={{
                body: {
                  color: colors.fg,
                  fontSize: 16,
                  lineHeight: 26,
                  fontFamily: 'Inter_400Regular',
                },
                paragraph: { marginTop: 0, marginBottom: 12 },
                blockquote: {
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accent,
                  paddingLeft: 14,
                  paddingVertical: 4,
                  marginVertical: 8,
                  fontFamily: 'InstrumentSerif_400Regular',
                  fontStyle: 'italic',
                },
                heading2: {
                  fontSize: 22,
                  marginTop: 16,
                  marginBottom: 8,
                  fontFamily: 'InstrumentSerif_400Regular',
                  color: colors.fg,
                },
                heading3: {
                  fontSize: 18,
                  marginTop: 12,
                  marginBottom: 6,
                  fontFamily: 'Inter_600SemiBold',
                  color: colors.fg,
                },
                link: { color: colors.accent, fontWeight: '600' as const },
              }}
            >
              {item.content}
            </Markdown>
          </View>
        ) : null}

        {(item.tags ?? []).length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {(item.tags ?? []).map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        {relatedItems.length > 0 ? (
          <View className="gap-3 pt-2">
            <Text
              className="text-fg"
              style={{
                fontFamily: 'InstrumentSerif_400Regular',
                fontSize: 22,
                letterSpacing: -0.3,
              }}
            >
              Related
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {relatedItems.map((rel) => (
                <RelatedCard key={rel.id} item={rel} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
      {editing ? (
        <EditModal
          item={item}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const RelatedCard: React.FC<{ item: Item }> = ({ item }) => {
  const thumb = thumbnailFor(item);
  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}`)}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      className="rounded-2xl overflow-hidden bg-card border border-border"
    >
      <View style={{ width: 160 }}>
        <View style={{ height: 110 }} className="relative bg-surface">
          {thumb.kind === 'image' ? (
            <Image
              source={{ uri: thumb.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-3xl">{thumb.glyph}</Text>
            </View>
          )}
          {domainLabel ? (
            <View
              className="absolute top-1.5 left-1.5 flex-row items-center gap-1 rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
            >
              {faviconUri ? (
                <Image
                  source={{ uri: faviconUri }}
                  style={{ width: 10, height: 10, borderRadius: 2 }}
                  contentFit="contain"
                />
              ) : null}
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 10,
                  color: '#1C1815',
                  maxWidth: 100,
                }}
                numberOfLines={1}
              >
                {domainLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="px-2.5 py-2 gap-0.5" style={{ height: 60 }}>
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 16 }}
            numberOfLines={2}
          >
            {item.title ?? 'Untitled'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const ReloadButton: React.FC<{ item: Item }> = ({ item }) => {
  const actions = useItemActions();
  const disabled = item.status === 'pending' || item.status === 'processing';
  const busy = actions.pending.has(item.id);
  const onPress = async () => {
    if (disabled || busy) return;
    const res = await actions.reloadItem(item.id);
    if (!res.ok && res.error.message !== 'Cancelled') {
      Alert.alert('Reload failed', res.error.message);
    }
  };
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} hitSlop={8}>
      <Text
        className={disabled || busy ? 'text-muted' : 'text-fg'}
        style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
      >
        {busy ? 'Reloading…' : 'Reload'}
      </Text>
    </Pressable>
  );
};

const DeleteButton: React.FC<{ id: string }> = ({ id }) => {
  const del = useDeleteItem();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        Alert.alert('Delete item?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await del.mutateAsync(id);
                router.back();
              } catch (err) {
                Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown');
              }
            },
          },
        ]);
      }}
    >
      <Text
        className="text-accent"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
      >
        Delete
      </Text>
    </Pressable>
  );
};

type EditProps = {
  item: Item;
  onClose: () => void;
};

const EditModal: React.FC<EditProps> = ({ item, onClose }) => {
  const [title, setTitle] = useState(item.title ?? '');
  const [summary, setSummary] = useState(item.summary ?? '');
  const [category, setCategory] = useState(item.category ?? '');
  const [tags, setTags] = useState((item.tags ?? []).join(', '));
  const patch = usePatchItem();
  const [error, setError] = useState<string | null>(null);
  const colors = useResolvedColors();

  useEffect(() => {
    setTitle(item.title ?? '');
    setSummary(item.summary ?? '');
    setCategory(item.category ?? '');
    setTags((item.tags ?? []).join(', '));
  }, [item]);

  const save = async () => {
    setError(null);
    try {
      await patch.mutateAsync({
        id: item.id,
        patch: {
          title: title.trim() || undefined,
          summary: summary.trim() || undefined,
          category: category.trim() || undefined,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-bg rounded-t-2xl p-4 gap-3">
          <Text className="text-xl font-semibold text-fg">Edit item</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <TextInput
            value={summary}
            onChangeText={setSummary}
            placeholder="Summary"
            placeholderTextColor={colors.muted}
            multiline
            className="min-h-[88px] rounded-xl border border-border bg-card px-3 py-2 text-fg"
          />
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="Tags (comma separated)"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          {error ? <Text className="text-danger">{error}</Text> : null}
          <View className="flex-row gap-2 pt-2">
            <View className="flex-1">
              <Button title="Cancel" variant="secondary" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button title="Save" loading={patch.isPending} onPress={save} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
