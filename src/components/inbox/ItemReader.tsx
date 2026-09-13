import { useItemEngagement } from '@/hooks/useItemEngagement';
import { AppIcon } from '@/components/ui/AppIcon';
import { readSemanticContent, canResumeSemantic } from '@/types/semantic';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EnrichedSections } from '@/components/inbox/EnrichedSections';
import { ExploreCTA } from '@/components/inbox/ExploreCTA';
import { SourceChip } from '@/components/inbox/SourceChip';
import { TagEditor } from '@/components/inbox/TagEditor';
import { ContentRenderer } from '@/components/inbox/content/ContentRenderer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useItemActions } from '@/hooks/useItemActions';
import { useDeleteItem, useItemById, usePatchItem } from '@/hooks/useItems';
import { useItemStatus } from '@/hooks/useItemStatus';
import { getContentType } from '@/lib/contentType';
import { ENV } from '@/lib/env';
import { pb } from '@/lib/pb';
import { relativeDate } from '@/lib/relativeDate';
import { sourceChip } from '@/lib/sourceChip';
import { hostOf, thumbnailFor } from '@/lib/thumbnails';
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

type ItemReaderProps = {
  id: string;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  paneWidth?: number;
  embedded?: boolean;
};

/** Shared by the compact detail route and the landscape Inbox reading pane. */
export function ItemReader({ id, onClose, onOpenItem, paneWidth, embedded = false }: ItemReaderProps) {
  const { data: item, isLoading, error } = useItemById(id);
  const engagement = useItemEngagement(item);
  // Pass the exploration status so the watcher re-arms when one starts. It
  // settles on a ready item, and an exploration can begin long after that.
  useItemStatus(id, item?.exploration?.status);
  const { data: relatedItems = [] } = useRelatedItems(item);
  const { width: windowWidth } = useWindowDimensions();
  const width = paneWidth ?? windowWidth;
  const colors = useResolvedColors();
  const actions = useItemActions();

  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteCanExpand, setNoteCanExpand] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
        <Button title={embedded ? "Close reader" : "Back"} variant="secondary" onPress={onClose} />
      </SafeAreaView>
    );
  }
  if (error || !item) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text className="text-base text-danger mb-4">
          This item could not be loaded. Check your connection or return to your inbox.
        </Text>
        <Button title={embedded ? "Close reader" : "Back"} variant="secondary" onPress={onClose} />
      </SafeAreaView>
    );
  }

  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;

  // Content type drives which renderer paints the body — and decides whether
  // the screen owns a static hero. youtube/reel/carousel renderers paint their
  // own primary media, so the static hero would just duplicate it. receipt
  // and generic don't, so they keep the hero block.
  const contentType = getContentType(item);
  const showHero = contentType === 'generic';

  const heroWidth = width - 32;
  const heroHeight = photoOpen ? Math.min(700, Math.round(heroWidth * 1.25)) : Math.min(200, Math.round(heroWidth * 0.55));
  const heroThumb = thumbnailFor(item);
  const firstSlideUri = item.media && item.media.length > 0
    ? `${ENV.R2_PUBLIC_URL}/${item.media[0]!.r2_key}`
    : null;
  const heroUri = firstSlideUri
    ?? (heroThumb.kind === 'image' ? heroThumb.uri : null);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityLabel={embedded ? "Close reader" : "Back"}
          accessibilityRole="button"
          className="flex-row min-h-[44px] items-center gap-1.5"
        >
          <Feather name={embedded ? "x" : "chevron-left"} size={20} color={colors.fg} />
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
          >
            {embedded ? 'Close' : 'Back'}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <ShareButton item={item} />
          <Pressable onPress={() => setActionsOpen(v => !v)} accessibilityRole="button" accessibilityLabel="Item actions" accessibilityState={{ expanded: actionsOpen }} className="w-11 h-11 items-center justify-center"><Feather name="more-horizontal" size={22} color={colors.fg} /></Pressable>
        </View>
      </View>
      {actionsOpen ? <View className="flex-row flex-wrap items-center justify-around px-4 border-b border-border bg-card">
        <ReloadButton item={item} />
        <Pressable onPress={() => { setEditing(true); setActionsOpen(false); }} accessibilityRole="button" className="min-h-[44px] justify-center px-3"><Text className="text-fg">Edit details</Text></Pressable>
        <DeleteButton id={item.id} onDeleted={onClose} />
      </View> : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>


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
            {item.title ?? item.raw_url ?? 'Saved item'}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <SourceChip chip={sourceChip(item, contentType)} />
            {item.category ? <Badge label={item.category} tone="accent" /> : null}
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              {relativeDate(item.created)}
            </Text>
            {item.status !== 'ready' ? (
              <Badge
                label={item.status === 'error' ? 'Processing failed' : 'Processing…'}
                tone={item.status === 'error' ? 'danger' : 'neutral'}
              />
            ) : null}
          </View>
        </View>

        <View className="gap-1">
          <Pressable onPress={() => { void engagement.toggleRead(); }} disabled={engagement.busy}
            accessibilityRole="button" accessibilityLabel={item.read_at ? 'Mark as unread' : 'Mark as read'}
            accessibilityState={{ disabled: engagement.busy }} className="min-h-[44px] flex-row items-center gap-2 self-start px-3 rounded-full border border-border">
            <Feather name={item.read_at ? 'check' : 'circle'} size={17} color={colors.muted} />
            <Text className="text-fg text-sm">{engagement.busy ? 'Saving…' : item.read_at ? 'Read · Mark as unread' : 'Mark as read'}</Text>
          </Pressable>
          <Text className="text-muted text-xs">{item.read_at ? 'Marked by you. You can undo this anytime.' : 'No read mark recorded. Opening does not mark this as read.'}</Text>
          {engagement.error ? <Text accessibilityRole="alert" className="text-danger text-sm">{engagement.error}</Text> : null}
        </View>

        {showHero && heroUri ? (
          <Pressable accessibilityRole="button" accessibilityLabel={photoOpen ? "Collapse image" : "Expand image"} accessibilityState={{ expanded: photoOpen }} onPress={() => setPhotoOpen(v => !v)} className="relative">
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
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <AppIcon type={item.type} size={48} />
                </View>
              )}
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
          </Pressable>
        ) : null}
        {url ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { if (url) void Linking.openURL(url); }}
            style={({ pressed }) => [pressed && { opacity: 0.92 }]}
            className="rounded-full bg-accent flex-row items-center justify-center gap-2"
            hitSlop={4}
          >
            <View className="flex-row items-center justify-center gap-2 py-3.5 px-5">
              <Feather name="external-link" size={16} color={colors.onAccent} />
              <Text
                className="text-on-accent"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15 }}
              >
                Open original
              </Text>
            </View>
          </Pressable>
        ) : null}


        {item.notes?.trim() ? (
          <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
            <View className="flex-row items-center gap-2">
              <Feather name="edit-3" size={14} color={colors.accent} />
              <Text className="text-muted text-xs font-medium">YOUR NOTE</Text>
            </View>
            <Text selectable className="text-fg text-base leading-6" numberOfLines={noteExpanded ? undefined : 5} onTextLayout={({ nativeEvent }) => { if (!noteExpanded) setNoteCanExpand(nativeEvent.lines.length >= 5); }}>
              {item.notes}
            </Text>
            {noteCanExpand ? (
              <Pressable onPress={() => setNoteExpanded(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: noteExpanded }} className="min-h-[44px] justify-center">
                <Text className="text-accent font-medium">{noteExpanded ? 'Show less' : 'Read full note'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {contentType === 'receipt' ? <ContentRenderer item={item} contentType={contentType} /> : null}
        {item.summary ? (
          <View style={{ position: 'relative' }}>

            <View
              className="rounded-2xl bg-card px-4 py-4 gap-2"
              style={{
                borderRadius: 18,
                shadowColor: '#1C1815',
                shadowOpacity: 0.05,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
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
          </View>
        ) : null}


        {item.status === 'error' ? (
          <View className="rounded-xl border border-danger bg-danger/10 p-3">
            <Text className="text-danger font-medium mb-1">Processing error</Text>
            <Text className="text-danger">We could not finish processing this save. Your original is still available.</Text>
            <ReloadButton item={item} />
          </View>
        ) : null}

        {contentType !== 'receipt' ? <ContentRenderer item={item} contentType={contentType} /> : null}

        {/* Rendered unconditionally, and NOT behind `item.exploration`.
            That field only exists once an exploration has already run: the
            server creates it when POST /api/items/bulk/explore starts a job.
            Gating on it meant the only control that can start one appeared
            solely on items that no longer needed it — and with auto-enrich at
            ingest opt-in and off (AUTO_ENRICH_ENABLED), that was every item.
            ExploreCTA already handles `exploration === undefined` as its
            `idle` variant. Only ready items can be explored (the server
            answers NOT_READY otherwise), so still gate on status. */}
        {item.status === 'ready' ? (
          <ExploreCTA
            resumeMode={canResumeSemantic(readSemanticContent(item.structured_content))}
            resourceMode={['list', 'entity'].includes(readSemanticContent(item.structured_content)?.layout ?? '')}
            exploration={item.exploration}
            isReceipt={item.type === 'receipt'}
            onPress={() => {
              void actions.exploreMany([item.id], { deep: true }).then((res) => {
                if (!res.ok && 'error' in res && res.error.message !== 'Cancelled') {
                  Alert.alert('Exploration failed', res.error.message);
                }
              });
            }}
          />
        ) : null}

        {item.exploration ? (
          <EnrichedSections exploration={item.exploration} />
        ) : null}


        <View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: tagsOpen }} className="min-h-[44px] justify-center" onPress={() => setTagsOpen(v => !v)}><View className="flex-row items-center gap-2"><Text className="text-muted font-medium">Tags ({item.tags?.length ?? 0})</Text><AppIcon name={tagsOpen ? 'chevron-up' : 'chevron-down'} size={16} /></View></Pressable>
          {tagsOpen ? <TagEditor item={item} /> : null}
        </View>

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
                <RelatedCard key={rel.id} item={rel} onOpenItem={onOpenItem} />
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

const RelatedCard: React.FC<{ item: Item; onOpenItem: (id: string) => void }> = ({ item, onOpenItem }) => {
  const thumb = thumbnailFor(item);
  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
  return (
    <Pressable
      onPress={() => onOpenItem(item.id)}
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
              <AppIcon name={thumb.icon} size={30} />
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
            {item.title ?? item.raw_url ?? 'Saved item'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const ShareButton: React.FC<{ item: Item }> = ({ item }) => {
  const colors = useResolvedColors();
  const onPress = async () => {
    const url = item.source_url ?? item.raw_url;
    const title = item.title ?? 'Flowy item';
    try {
      await Share.share(
        url
          ? { url, message: `${title}\n${url}`, title }
          : { message: title, title },
      );
    } catch {
      // Share sheet cancellations come back as rejections on iOS in some RN
      // versions — silently ignore. Other errors aren't worth alerting on.
    }
  };
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Share item" className="w-11 h-11 items-center justify-center">
      <Feather name="share" size={20} color={colors.fg} />
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
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} className="min-h-[44px] justify-center px-3" onPress={onPress} disabled={disabled || busy}>
      <Text
        className={disabled || busy ? 'text-muted' : 'text-fg'}
        style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
      >
        {busy ? 'Processing…' : item.status === 'error' ? 'Retry processing' : 'Reprocess'}
      </Text>
    </Pressable>
  );
};

const DeleteButton: React.FC<{ id: string; onDeleted: () => void }> = ({ id, onDeleted }) => {
  const del = useDeleteItem();
  return (
    <Pressable
      accessibilityRole="button" className="min-h-[44px] justify-center px-3"
      onPress={() => {
        Alert.alert('Delete item?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await del.mutateAsync(id);
                onDeleted();
              } catch (err) {
                Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown');
              }
            },
          },
        ]);
      }}
    >
      <Text
        className="text-danger"
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-black/40 justify-end">
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }} className="bg-bg rounded-t-2xl" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
          <Text className="text-xl font-semibold text-fg">Edit item</Text>
          <Text className="text-fg text-sm">Title</Text>
          <TextInput accessibilityLabel="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <Text className="text-fg text-sm">Summary</Text>
          <TextInput accessibilityLabel="Summary"
            value={summary}
            onChangeText={setSummary}
            placeholder="Summary"
            placeholderTextColor={colors.muted}
            multiline
            className="min-h-[88px] rounded-xl border border-border bg-card px-3 py-2 text-fg"
          />
          <Text className="text-fg text-sm">Category</Text>
          <TextInput accessibilityLabel="Category"
            value={category}
            onChangeText={setCategory}
            placeholder="Category"
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <Text className="text-fg text-sm">Tags, separated by commas</Text>
          <TextInput accessibilityLabel="Tags, separated by commas"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
