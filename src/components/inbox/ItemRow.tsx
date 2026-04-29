import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

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

const compactRelative = (input: string, now: Date = new Date()): string => {
  const then = new Date(input);
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return '';
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return monthDayLabel(input);
};

type Props = { item: Item };

export const ItemRow: React.FC<Props> = ({ item }) => {
  const pending = isPending(item);
  const errored = item.status === 'error';
  const ready = item.status === 'ready';
  const selection = useSelection();
  const selected = selection.selectedIds.has(item.id);
  const thumb = thumbnailFor(item);
  const url = item.source_url ?? item.raw_url;
  const host = url ? hostOf(url) : null;
  const domainLabel = host ? stripWww(host) : null;

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

  const subline = [domainLabel, item.category, compactRelative(item.created)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <Pressable
        disabled={pending && !selection.mode}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          {
            minHeight: 64,
            shadowColor: '#1C1815',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          },
          pressed && !pending && { opacity: 0.92, transform: [{ scale: 0.995 }] },
        ]}
        className={`flex-row items-center gap-3 mx-4 mb-2 px-3 py-3 rounded-2xl bg-card ${
          selected ? 'border-2 border-accent' : ''
        }`}
      >
        {selection.mode ? (
          <View
            className={`w-6 h-6 rounded-full items-center justify-center border-2 ${
              selected ? 'bg-accent border-accent' : 'border-border bg-card'
            }`}
          >
            {selected ? <Feather name="check" size={14} color="#fff" /> : null}
          </View>
        ) : null}
        <View
          className="rounded-lg bg-surface items-center justify-center overflow-hidden border border-border"
          style={{ width: 40, height: 40 }}
        >
          {thumb.kind === 'image' ? (
            <Image
              source={{ uri: thumb.uri }}
              contentFit="cover"
              style={{ width: 40, height: 40 }}
            />
          ) : (
            <Text className="text-lg">{thumb.glyph}</Text>
          )}
          {item.media && item.media.length > 1 ? (
            <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent items-center justify-center">
              <Text
                className="text-white text-[9px]"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {item.media.length}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-1 gap-0.5">
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 15 }}
            numberOfLines={1}
          >
            {item.title ?? 'Untitled'}
          </Text>
          <Text
            className="text-muted"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            numberOfLines={1}
          >
            {subline || item.type}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text
            className="text-muted"
            style={{ fontFamily: 'InstrumentSerif_400Regular', fontSize: 16 }}
          >
            {monthDayLabel(item.created)}
          </Text>
          <View
            className={`w-2 h-2 rounded-full ${
              errored
                ? 'bg-danger'
                : pending
                  ? 'bg-accent'
                  : ready
                    ? 'bg-success'
                    : 'bg-muted/40'
            }`}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
};
