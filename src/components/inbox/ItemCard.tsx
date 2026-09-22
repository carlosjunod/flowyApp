import { ItemStatus } from './ItemStatus';
import { itemPresentation, type CardSize } from '@/types/inbox-presentation';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { itemTypeLabelKey } from '@/lib/itemIcons';
import { AppIcon } from '@/components/ui/AppIcon';
import { SemanticPreview } from './content/SemanticContent';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ItemActionsMenu } from './ItemActionsMenu';
import { Pressable, Text, View } from 'react-native';

import { hostOf, thumbnailFor } from '@/lib/thumbnails';
import { useSelection } from '@/lib/selection';
import type { Item } from '@/types';

const isPending = (item: Item) => item.status === 'pending' || item.status === 'processing';

const stripWww = (host: string): string => host.replace(/^www\./, '');

const VIDEO_TYPES = new Set(['youtube', 'video', 'screen_recording']);

type Props = { onOpen?: (id: string) => void; active?: boolean; item: Item; size?: CardSize };

export const ItemCard: React.FC<Props> = ({ onOpen, active = false, item, size = 'medium' }) => {
  const pending = isPending(item);
  const { t, tKey, formatDate } = useI18n();
  const colors = useResolvedColors();
  const presentation = itemPresentation(item);
  const selection = useSelection();
  const selected = selection.selectedIds.has(item.id);
  const thumb = thumbnailFor(item);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const hasPhoto = thumb.kind === 'image' && thumb.uri !== failedUri;
  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;
  const faviconUri = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    : null;
  const isVideo = VIDEO_TYPES.has(item.type);

  const handlePress = () => {
    if (selection.mode) {
      selection.toggle(item.id);
      return;
    }
    if (onOpen) onOpen(item.id);
    else router.push(`/item/${item.id}`);
  };

  const handleLongPress = () => {
    if (!selection.mode) selection.enterWith(item.id);
    else selection.toggle(item.id);
  };

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole={selection.mode ? 'checkbox' : 'button'}
        // The title is the user's own text; everything appended to it is
        // interface copy resolved from the presentation contract's keys.
        accessibilityLabel={`${item.title ?? item.raw_url ?? t('inbox.card.savedItem')}${item.read_at ? t('inbox.card.markedRead') : t('inbox.card.noReadMark')}, ${tKey(presentation.labelKey)}${presentation.noticeKey ? ', ' + tKey(presentation.noticeKey) : ''}`}
        accessibilityState={{ checked: selection.mode ? selected : undefined, selected: !selection.mode && active }}
        accessibilityActions={[{ name: 'longpress', label: t('inbox.card.selectItem') }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') handleLongPress(); }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={{
            elevation: 2,
            backgroundColor: presentation.deep ? colors.inboxDeep : colors.card,
            borderWidth: selected || active ? 2 : 1,
            borderColor: selected || active ? colors.accent : presentation.deep ? colors.inboxDeepBorder : colors.border,
            shadowColor: '#1C1815',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
        }}
        className={`flex-1 active:opacity-90 rounded-[20px] overflow-hidden ${
          selected || (!selection.mode && active) ? 'border-2 border-accent' : ''
        }`}
      >
        {hasPhoto ? (
          <ImageLed
            item={item}
            onError={() => setFailedUri(thumb.kind === 'image' ? thumb.uri : null)}
            thumb={thumb as { kind: 'image'; uri: string }}
            faviconUri={faviconUri}
            domainLabel={domainLabel}
            isVideo={isVideo}
            pending={pending}
            selected={selected}
            selectionMode={selection.mode}
          />
        ) : (
          <Editorial
            item={item}
            faviconUri={faviconUri}
            domainLabel={domainLabel}
            pending={pending}
            selected={selected}
            selectionMode={selection.mode}
          />
        )}

        <View className="px-3 pt-3 pb-3 gap-1.5">
          <Text
            className="text-fg"
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: size === 'small' ? 15 : size === 'large' ? 19 : 16,
              lineHeight: size === 'large' ? 24 : 22,
              letterSpacing: -0.2,
            }}
            numberOfLines={2}
          >
            {item.title ?? item.raw_url ?? (pending ? t('inbox.card.preparing') : t('inbox.card.savedItem'))}
          </Text>
          <SemanticPreview item={item} />
          {/* AI summary — rendered as generated, never translated. */}
          {item.summary ? <Text className="text-muted text-sm" numberOfLines={size === 'small' ? 1 : size === 'large' ? 3 : 2}>{item.summary}</Text> : null}
          <View className="flex-row items-end justify-between">
            <Text
              className="text-muted text-xs flex-1 pr-2"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {/* The user's own category wins; the type name is interface copy. */}
              {item.category ?? tKey(itemTypeLabelKey[item.type])}
            </Text>
            <Text
              className="text-muted"
              style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            >
              {formatDate(item.created, { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <ItemStatus item={item} selectionMode={selection.mode} />
        </View>
      </Pressable>
      {!selection.mode ? <View style={{ position: 'absolute', top: 8, right: 8 }}><ItemActionsMenu item={item} variant="compact" /></View> : null}
    </View>
  );
};

type LedProps = {
  onError: () => void;
  item: Item;
  thumb: { kind: 'image'; uri: string };
  faviconUri: string | null;
  domainLabel: string | null;
  isVideo: boolean;
  pending: boolean;
  selected: boolean;
  selectionMode: boolean;
};

const ImageLed: React.FC<LedProps> = ({
  onError,
  item,
  thumb,
  faviconUri,
  domainLabel,
  isVideo,
  pending,
  selected,
  selectionMode,
}) => {
  const { t } = useI18n();
  return (
  <View className="relative" style={{ aspectRatio: 1.6 }}>
    <Image
      source={{ uri: thumb.uri }}
      onError={onError}
      contentFit="cover"
      transition={150}
      style={{ width: '100%', height: '100%' }}
    />
    {domainLabel ? (
      <View
        className="absolute top-2.5 left-2.5 flex-row items-center gap-1.5 rounded-full px-2 py-1"
        style={{ backgroundColor: 'rgba(255,255,255,0.92)', right: 56 }}
      >
        {faviconUri ? (
          <Image
            source={{ uri: faviconUri }}
            style={{ width: 12, height: 12, borderRadius: 2 }}
            contentFit="contain"
          />
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 11,
            color: '#1C1815',
            maxWidth: 140,
            flexShrink: 1,
          }}
        >
          {domainLabel}
        </Text>
      </View>
    ) : null}
    {isVideo ? (
      <View
        className="absolute bottom-2.5 left-2.5 flex-row items-center gap-1 rounded-full px-2 py-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      >
        <Feather name="play" size={10} color="#fff" />
        <Text
          style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#fff' }}
        >
          {item.type === 'youtube' ? t('inbox.card.video') : t('inbox.card.clip')}
        </Text>
      </View>
    ) : null}
    {item.media && item.media.length > 1 ? (
      <View className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded-full bg-black/60">
        <Text
          className="text-white text-[10px]"
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          1/{item.media.length}
        </Text>
      </View>
    ) : null}
    {selectionMode ? (
      <View
        className={`absolute top-2.5 ${
          domainLabel ? 'right-2.5' : 'left-2.5'
        } w-6 h-6 rounded-full items-center justify-center border-2 ${
          selected ? 'bg-accent border-accent' : 'bg-black/40 border-white/80'
        }`}
      >
        {selected ? <Feather name="check" size={14} color="#fff" /> : null}
      </View>
    ) : null}

  </View>
  );
};

type EditorialProps = {
  item: Item;
  faviconUri: string | null;
  domainLabel: string | null;
  pending: boolean;
  selected: boolean;
  selectionMode: boolean;
};

const Editorial: React.FC<EditorialProps> = ({ item, faviconUri, domainLabel, selected, selectionMode }) => (
  <View className="bg-surface min-h-14 pl-3 pr-14 py-3 flex-row items-center gap-2">
    {faviconUri ? <Image source={{ uri: faviconUri }} style={{ width: 18, height: 18, borderRadius: 3 }} /> : <AppIcon type={item.type} size={18} />}
    <Text className="text-muted text-xs flex-1" numberOfLines={1}>{domainLabel ?? item.type}</Text>
    {selectionMode ? <Feather name={selected ? 'check-circle' : 'circle'} size={22} color={selected ? '#A74326' : '#6B6258'} /> : null}
  </View>
);
