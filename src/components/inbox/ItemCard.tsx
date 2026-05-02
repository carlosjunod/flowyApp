import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Shimmer } from '@/components/ui/Shimmer';
import { Spinner } from '@/components/ui/Spinner';
import { hostOf, thumbnailFor, typeGlyph } from '@/lib/thumbnails';
import { useSelection } from '@/lib/selection';
import type { Item } from '@/types';

const isPending = (item: Item) => item.status === 'pending' || item.status === 'processing';

const stripWww = (host: string): string => host.replace(/^www\./, '');

const monthDayLabel = (input: string): string => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`;
};

const VIDEO_TYPES = new Set(['youtube', 'video', 'screen_recording']);

type Props = { item: Item };

export const ItemCard: React.FC<Props> = ({ item }) => {
  const pending = isPending(item);
  const errored = item.status === 'error';
  const selection = useSelection();
  const selected = selection.selectedIds.has(item.id);
  const thumb = thumbnailFor(item);
  const hasPhoto = thumb.kind === 'image' && Boolean(item.r2_key);
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
    if (pending || errored) return;
    router.push(`/item/${item.id}`);
  };

  const handleLongPress = () => {
    if (pending) return;
    if (!selection.mode) selection.enterWith(item.id);
    else selection.toggle(item.id);
  };

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        disabled={pending && !selection.mode}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          {
            elevation: 2,
            shadowColor: '#1C1815',
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          },
          pressed && !pending && { transform: [{ scale: 0.98 }], opacity: 0.97 },
        ]}
        className={`bg-card rounded-[20px] overflow-hidden ${
          selected ? 'border-2 border-accent' : ''
        } ${pending ? 'opacity-80' : ''}`}
      >
        {hasPhoto ? (
          <ImageLed
            item={item}
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
              fontSize: 19,
              lineHeight: 24,
              letterSpacing: -0.2,
            }}
            numberOfLines={2}
          >
            {item.title ?? 'Untitled'}
          </Text>
          <View className="flex-row items-end justify-between">
            <Text
              className="text-muted text-xs flex-1 pr-2"
              numberOfLines={1}
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {item.category ?? typeGlyph[item.type]}
            </Text>
            <Text
              className="text-muted"
              style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 18, letterSpacing: -0.3 }}
            >
              {monthDayLabel(item.created)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

type LedProps = {
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
  item,
  thumb,
  faviconUri,
  domainLabel,
  isVideo,
  pending,
  selected,
  selectionMode,
}) => (
  <View className="relative" style={{ aspectRatio: 1.05 }}>
    <Image
      source={{ uri: thumb.uri }}
      contentFit="cover"
      transition={150}
      style={{ width: '100%', height: '100%' }}
    />
    {domainLabel ? (
      <View
        className="absolute top-2.5 left-2.5 flex-row items-center gap-1.5 rounded-full px-2 py-1"
        style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
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
          {item.type === 'youtube' ? 'Video' : 'Clip'}
        </Text>
      </View>
    ) : null}
    {item.media && item.media.length > 1 ? (
      <View className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-full bg-black/60">
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
    {pending ? (
      <>
        <Shimmer />
        <View className="absolute inset-0 items-center justify-center">
          <Spinner tint="muted" />
        </View>
      </>
    ) : null}
  </View>
);

type EditorialProps = {
  item: Item;
  faviconUri: string | null;
  domainLabel: string | null;
  pending: boolean;
  selected: boolean;
  selectionMode: boolean;
};

const Editorial: React.FC<EditorialProps> = ({
  item,
  faviconUri,
  domainLabel,
  pending,
  selected,
  selectionMode,
}) => (
  <View
    className="relative bg-surface px-4 pt-5 pb-4 gap-3"
    style={{ aspectRatio: 1.05 }}
  >
    <View className="flex-row items-center gap-1.5">
      {faviconUri ? (
        <Image
          source={{ uri: faviconUri }}
          style={{ width: 14, height: 14, borderRadius: 3 }}
          contentFit="contain"
        />
      ) : (
        <Text className="text-base">{typeGlyph[item.type]}</Text>
      )}
      <Text
        className="text-muted"
        style={{ fontFamily: 'Inter_500Medium', fontSize: 11 }}
        numberOfLines={1}
      >
        {domainLabel ?? item.type}
      </Text>
    </View>
    <Text
      className="text-fg flex-1"
      style={{
        fontFamily: 'InstrumentSerif_400Regular',
        fontSize: 26,
        lineHeight: 30,
        letterSpacing: -0.3,
      }}
      numberOfLines={4}
    >
      {item.title ?? 'Untitled'}
    </Text>
    {selectionMode ? (
      <View
        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-full items-center justify-center border-2 ${
          selected ? 'bg-accent border-accent' : 'border-border bg-card'
        }`}
      >
        {selected ? <Feather name="check" size={14} color="#fff" /> : null}
      </View>
    ) : null}
    {pending ? (
      <View className="absolute inset-0 items-center justify-center">
        <Spinner tint="muted" />
      </View>
    ) : null}
  </View>
);
