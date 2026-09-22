import { itemPresentation } from '@/types/inbox-presentation';
import { useItemEngagement } from '@/hooks/useItemEngagement';
import { AppIcon } from '@/components/ui/AppIcon';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import { ReaderImage } from '@/components/inbox/ReaderImage';
import { ReaderSwipe } from '@/components/inbox/ReaderSwipe';
import { SourceChip, useSourceChipLabel } from '@/components/inbox/SourceChip';
import { TagEditor } from '@/components/inbox/TagEditor';
import { READER_COPY, readerAction, readerSummary, readerDate } from '@/types/reader';
import { SourceIdentity } from '@/components/inbox/content/SourceIdentity';
import { SemanticContent } from '@/components/inbox/content/SemanticContent';
import { SourceText } from '@/components/inbox/content/SourceText';
import { CollapsibleSection } from '@/components/inbox/CollapsibleSection';
import { OriginalFiles } from '@/components/inbox/OriginalFiles';
import { ContentRenderer } from '@/components/inbox/content/ContentRenderer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useItemActions } from '@/hooks/useItemActions';
import { useDeleteItem, useItemById, usePatchItem, useRelatedItems } from '@/hooks/useItems';
import { useItemStatus } from '@/hooks/useItemStatus';
import { apiErrorKey, caughtErrorKey } from '@/lib/apiErrors';
import { getContentType } from '@/lib/contentType';
import { ENV } from '@/lib/env';
import { useI18n } from '@/lib/i18n';
import { sourceChip } from '@/lib/sourceChip';
import { hostOf, thumbnailFor } from '@/lib/thumbnails';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

const stripWww = (h: string) => h.replace(/^www\./, '');


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
  const { t, tKey, locale } = useI18n();
  const colors = useResolvedColors();
  const actions = useItemActions();
  // `sourceChip` returns a key + optional source text; resolve once so the
  // header chip and the "Tags and details" line cannot drift apart.
  const contentTypeForChip = item ? getContentType(item) : 'generic';
  const chip = item ? sourceChip(item, contentTypeForChip) : null;
  const chipLabel = useSourceChipLabel(chip ?? { icon: 'paperclip', labelKey: 'inbox.sourceChip.item' });

  const [startingResearch, setStartingResearch] = useState(false);
  const researchLock = useRef(false);
  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const scrollGesture = useMemo(() => Gesture.Native(), []);

  const startResearch = async () => {
    if (!item || researchLock.current || item.exploration?.status === 'exploring') return;
    researchLock.current = true;
    setStartingResearch(true);
    try {
      const result = await actions.exploreMany([item.id], { deep: !readerAction(item).resume });
      if (!result.ok && 'error' in result) Alert.alert(t('inbox.detail.exploreFailedTitle'), tKey(apiErrorKey(result.error)));
      else if (result.ok && result.data.failed.length) Alert.alert(t('inbox.detail.exploreFailedTitle'), t('inbox.detail.exploreFailedBody'));
    } finally { researchLock.current = false; setStartingResearch(false); }
  };

  if (isLoading) {
    return (
      <ReaderSwipe onClose={onClose} scrollGesture={scrollGesture} disabled={embedded}>
      <SafeAreaView className="flex-1 bg-bg">
        <Spinner className="mt-12" size="large" />
        <Button title={embedded ? t('inbox.detail.closeReader') : t('inbox.detail.back')} variant="secondary" onPress={onClose} />
      </SafeAreaView>
      </ReaderSwipe>
    );
  }
  if (error || !item) {
    return (
      <ReaderSwipe onClose={onClose} scrollGesture={scrollGesture} disabled={embedded}>
      <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
        <Text accessibilityRole="alert" className="text-base text-danger mb-4">
          {t('inbox.detail.loadFailed')}
        </Text>
        <Button title={embedded ? t('inbox.detail.closeReader') : t('inbox.detail.back')} variant="secondary" onPress={onClose} />
      </SafeAreaView>
      </ReaderSwipe>
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
  const showHero = contentType === 'generic' && item.type !== 'pdf' && item.type !== 'file';

  const heroWidth = width - 32;
  const heroHeight = photoOpen ? Math.min(700, Math.round(heroWidth * 1.25)) : Math.min(200, Math.round(heroWidth * 0.55));
  const heroThumb = thumbnailFor(item);
  const firstSlideUri = item.media && item.media.length > 0
    ? `${ENV.R2_PUBLIC_URL}/${item.media[0]!.r2_key}`
    : null;
  const heroUri = firstSlideUri
    ?? (heroThumb.kind === 'image' ? heroThumb.uri : null);

  return (
    <ReaderSwipe onClose={onClose} scrollGesture={scrollGesture} disabled={embedded || editing || photoOpen}>
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityLabel={embedded ? t('inbox.detail.closeReader') : t('inbox.detail.back')}
          accessibilityRole="button"
          className="flex-row min-h-[44px] items-center gap-1.5"
        >
          <Feather name={embedded ? "x" : "chevron-left"} size={20} color={colors.fg} />
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
          >
            {embedded ? t('inbox.detail.close') : t('inbox.detail.back')}
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <ShareButton item={item} />
          <Pressable onPress={() => setActionsOpen(v => !v)} accessibilityRole="button" accessibilityLabel={t('inbox.detail.actions')} accessibilityState={{ expanded: actionsOpen }} className="w-11 h-11 items-center justify-center"><Feather name="more-horizontal" size={22} color={colors.fg} /></Pressable>
        </View>
      </View>
      {actionsOpen ? <View className="flex-row flex-wrap items-center justify-around px-4 border-b border-border bg-card">
        <ReloadButton item={item} />
        <Pressable onPress={() => { setEditing(true); setActionsOpen(false); }} accessibilityRole="button" className="min-h-[44px] justify-center px-3"><Text className="text-fg">{t('inbox.detail.editDetails')}</Text></Pressable>
        <DeleteButton id={item.id} onDeleted={onClose} />
      </View> : null}
      <GestureDetector gesture={scrollGesture}>
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
            {item.title ?? item.raw_url ?? t('inbox.card.savedItem')}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <SourceChip chip={sourceChip(item, contentType)} />
            {/* The category is the user's own word. */}
            {item.category ? <Badge label={item.category} tone="accent" /> : null}
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              {readerDate(item.created, locale)}
            </Text>
            {item.status !== 'ready' ? (
              <Badge
                label={tKey(itemPresentation(item).labelKey)}
                tone="neutral"
              />
            ) : null}
          </View>
        </View>

        <SourceIdentity item={item} />
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {url ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => { if (url) void Linking.openURL(url); }}
            className="rounded-full bg-accent flex-row items-center justify-center gap-2"
            style={{ flex: 1, minWidth: 145 }}
            hitSlop={4}
          >
            <View className="flex-row items-center justify-center gap-2 py-3 px-4">
              <Feather name="external-link" size={16} color={colors.onAccent} />
              <Text
                className="text-on-accent"
                style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15 }}
              >
                {t('inbox.detail.openOriginal')}
              </Text>
            </View>
          </Pressable>
        ) : null}


        <View style={{ flex: 1, minWidth: 145 }}>
          <Pressable onPress={() => { void engagement.toggleRead(); }} disabled={engagement.busy}
            accessibilityRole="button" accessibilityLabel={tKey(item.read_at ? READER_COPY.markUnread : READER_COPY.markRead)}
            accessibilityState={{ disabled: engagement.busy }} className="min-h-[44px] flex-row items-center justify-center gap-2 px-3 rounded-full border border-border">
            <Feather name={item.read_at ? 'check' : 'circle'} size={17} color={colors.muted} />
            <Text className="text-fg text-sm">{engagement.busy ? t('inbox.read.saving') : tKey(item.read_at ? READER_COPY.markUnread : READER_COPY.markRead)}</Text>
          </Pressable>
          {engagement.errorKey ? <Text accessibilityRole="alert" className="text-danger text-sm">{tKey(engagement.errorKey)}</Text> : null}
        </View>

          </View>
          <Text className="text-muted" style={{ fontSize: 12, lineHeight: 18 }}>{tKey(READER_COPY.readingHint)}</Text>
        </View>
        {(
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
                  {tKey(READER_COPY.takeaways)}
                </Text>
              </View>
              {/* Either the AI's own summary, rendered as written, or a
                  translated placeholder — `readerSummary` says which. */}
              <Text
                className="text-fg"
                style={{ fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 25 }}
              >
                {(() => {
                  const summary = readerSummary(item);
                  return 'text' in summary ? summary.text : tKey(summary.key);
                })()}
              </Text>
            </View>
          </View>
        )}


        {item.status === 'error' ? (
          <View className="rounded-xl border border-border bg-surface p-3">
            <Text className="text-fg font-medium mb-1">{tKey(itemPresentation(item).labelKey)}</Text>
            <Text className="text-muted">{(() => {
              const noticeKey = itemPresentation(item).noticeKey;
              return noticeKey ? tKey(noticeKey) : '';
            })()}</Text>
            <ReloadButton item={item} />
          </View>
        ) : null}

        <SemanticContent item={item} action={readerAction(item).resume ? <ExploreCTA item={item} starting={startingResearch} onPress={startResearch} /> : undefined} />
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" className="text-fg" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>{tKey(READER_COPY.original)}</Text>
        {showHero && heroUri ? (
          <Pressable accessibilityRole="button" accessibilityLabel={photoOpen ? t('inbox.detail.collapseImage') : t('inbox.detail.expandImage')} accessibilityState={{ expanded: photoOpen }} onPress={() => setPhotoOpen(v => !v)} className="relative">
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
                <ReaderImage uri={heroUri} label={item.title ?? t('inbox.detail.savedImage')} />
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
          <OriginalFiles item={item} />
          <ContentRenderer item={item} contentType={contentType} />
        </View>
        {item.status === 'ready' && !readerAction(item).resume ? <ExploreCTA item={item} starting={startingResearch} onPress={startResearch} /> : null}
        {item.exploration && ['enriched', 'no_match', 'error'].includes(item.exploration.status) ? <EnrichedSections exploration={item.exploration} /> : null}
        {item.notes?.trim() ? <CollapsibleSection label={t('inbox.detail.yourNotes')} defaultOpen>
          <SourceText text={item.notes} />
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} className="min-h-[44px] justify-center"><Text className="text-accent">{t('inbox.detail.editNotes')}</Text></Pressable>
        </CollapsibleSection> : null}



        <CollapsibleSection label={t('inbox.detail.tagsAndDetails')} defaultOpen={false}>
          <Text className="text-muted text-sm mb-3">{chipLabel}{item.category ? ` · ${item.category}` : ''}</Text>
          <TagEditor item={item} />
          <Text className="text-muted text-xs mt-4">{t('inbox.detail.savedOn', { date: readerDate(item.created, locale) })}</Text>
        </CollapsibleSection>

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
              {t('inbox.detail.related')}
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
      </GestureDetector>
      {editing ? (
        <EditModal
          item={item}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </SafeAreaView>
    </ReaderSwipe>
  );
}

const RelatedCard: React.FC<{ item: Item; onOpenItem: (id: string) => void }> = ({ item, onOpenItem }) => {
  const { t } = useI18n();
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
      accessibilityRole="button"
      className="rounded-2xl overflow-hidden bg-card border border-border active:opacity-80"
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
        <View className="px-2.5 py-2 gap-0.5" style={{ minHeight: 60 }}>
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 16 }}
          >
            {item.title ?? item.raw_url ?? t('inbox.card.savedItem')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const ShareButton: React.FC<{ item: Item }> = ({ item }) => {
  const colors = useResolvedColors();
  const { t } = useI18n();
  const onPress = async () => {
    const url = item.source_url ?? item.raw_url;
    const title = item.title ?? t('inbox.detail.shareFallbackTitle');
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('inbox.detail.share')} className="w-11 h-11 items-center justify-center">
      <Feather name="share" size={20} color={colors.fg} />
    </Pressable>
  );
};

const ReloadButton: React.FC<{ item: Item }> = ({ item }) => {
  const actions = useItemActions();
  const { t, tKey } = useI18n();
  const disabled = item.status === 'pending' || item.status === 'processing';
  const busy = actions.pending.has(item.id);
  const onPress = async () => {
    if (disabled || busy) return;
    const res = await actions.reloadItem(item.id);
    if (!res.ok && 'error' in res) {
      Alert.alert(t('inbox.detail.reloadFailedTitle'), tKey(apiErrorKey(res.error)));
    }
  };
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} className="min-h-[44px] justify-center px-3" onPress={onPress} disabled={disabled || busy}>
      <Text
        className={disabled || busy ? 'text-muted' : 'text-fg'}
        style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}
      >
        {busy ? t('inbox.detail.processing') : item.status === 'error' ? t('inbox.actionsMenu.retryProcessing') : t('inbox.detail.reprocess')}
      </Text>
    </Pressable>
  );
};

const DeleteButton: React.FC<{ id: string; onDeleted: () => void }> = ({ id, onDeleted }) => {
  const del = useDeleteItem();
  const { t, tKey } = useI18n();
  return (
    <Pressable
      accessibilityRole="button" className="min-h-[44px] justify-center px-3"
      onPress={() => {
        Alert.alert(t('inbox.detail.deleteTitle'), t('inbox.detail.deleteBody'), [
          { text: t('inbox.selection.cancel'), style: 'cancel' },
          {
            text: t('inbox.detail.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await del.mutateAsync(id);
                onDeleted();
              } catch (err) {
                if (err instanceof Error) console.warn('[ItemReader] delete failed', err.message);
                Alert.alert(t('inbox.detail.deleteFailedTitle'), tKey(caughtErrorKey(err, 'inbox.detail.unknownError')));
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
        {t('inbox.detail.delete')}
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
  const [notes, setNotes] = useState(item.notes ?? '');
  const patch = usePatchItem();
  const { t, tKey } = useI18n();
  // A translation key: the mapped error code when there is one, a translated
  // fallback otherwise. Never the server's raw message — see `caughtErrorKey`.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const colors = useResolvedColors();

  useEffect(() => {
    setTitle(item.title ?? '');
    setSummary(item.summary ?? '');
    setCategory(item.category ?? '');
    setTags((item.tags ?? []).join(', '));
    setNotes(item.notes ?? '');
  }, [item.id]);

  const save = async () => {
    setErrorKey(null);
    try {
      await patch.mutateAsync({
        id: item.id,
        patch: {
          title: title.trim() || undefined,
          summary: summary.trim() || undefined,
          category: category.trim() || undefined,
          notes,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      onClose();
    } catch (err) {
      if (err instanceof Error) console.warn('[ItemReader] save failed', err.message);
      setErrorKey(caughtErrorKey(err, 'inbox.edit.saveFailed'));
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-black/40 justify-end">
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }} className="bg-bg rounded-t-2xl" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
          <Text className="text-xl font-semibold text-fg">{t('inbox.edit.title')}</Text>
          <Text className="text-fg text-sm">{t('inbox.edit.fieldTitle')}</Text>
          <TextInput accessibilityLabel={t('inbox.edit.fieldTitle')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('inbox.edit.fieldTitle')}
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <Text className="text-fg text-sm">{t('inbox.edit.fieldSummary')}</Text>
          <TextInput accessibilityLabel={t('inbox.edit.fieldSummary')}
            value={summary}
            onChangeText={setSummary}
            placeholder={t('inbox.edit.fieldSummary')}
            placeholderTextColor={colors.muted}
            multiline
            className="min-h-[88px] rounded-xl border border-border bg-card px-3 py-2 text-fg"
          />
          <Text className="text-fg text-sm">{t('inbox.edit.fieldCategory')}</Text>
          <TextInput accessibilityLabel={t('inbox.edit.fieldCategory')}
            value={category}
            onChangeText={setCategory}
            placeholder={t('inbox.edit.fieldCategory')}
            placeholderTextColor={colors.muted}
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <Text className="text-fg text-sm">{t('inbox.edit.fieldTags')}</Text>
          <TextInput accessibilityLabel={t('inbox.edit.fieldTags')}
            value={tags}
            onChangeText={setTags}
            placeholder={t('inbox.edit.tagsPlaceholder')}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            className="h-11 rounded-xl border border-border bg-card px-3 text-fg"
          />
          <Text className="text-fg text-sm">{t('inbox.edit.fieldNotes')}</Text>
          <TextInput accessibilityLabel={t('inbox.edit.fieldNotes')} multiline value={notes} onChangeText={setNotes} placeholder={t('inbox.edit.notesPlaceholder')} placeholderTextColor={colors.muted} className="min-h-[120px] rounded-xl border border-border bg-card p-3 text-fg" textAlignVertical="top" />
          {errorKey ? <Text accessibilityRole="alert" className="text-danger">{tKey(errorKey)}</Text> : null}
          <View className="flex-row gap-2 pt-2">
            <View className="flex-1">
              <Button title={t('common.actions.cancel')} variant="secondary" onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button title={t('common.actions.save')} loading={patch.isPending} onPress={save} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
