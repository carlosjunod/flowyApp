import { ItemStatus } from './ItemStatus';
import { itemPresentation } from '@/types/inbox-presentation';
import { useResolvedColors } from '@/lib/theme';
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

type Props = { onOpen?: (id: string) => void; active?: boolean; item: Item; inColumn?: boolean; detailed?: boolean };

export const ItemRow: React.FC<Props> = ({ onOpen, active = false, item, inColumn = false, detailed = false }) => {
  const pending = isPending(item);
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

  const subline = [domainLabel, item.category, compactRelative(item.created)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <Pressable
        accessibilityRole={selection.mode ? 'checkbox' : 'button'}
        accessibilityLabel={`${item.title ?? item.raw_url ?? 'Saved item'}${item.read_at ? ', marked as read' : ', no read mark recorded'}${", " + presentation.label + (presentation.notice ? ", " + presentation.notice : "")}`}
        accessibilityState={{ checked: selection.mode ? selected : undefined, selected: !selection.mode && active }}
        accessibilityActions={[{ name: 'longpress', label: 'Select item' }]}
        onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') handleLongPress(); }}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={{
            minHeight: 64,
            backgroundColor: presentation.deep ? colors.inboxDeep : colors.card,
            borderWidth: selected || active ? 2 : 1,
            borderColor: selected || active ? colors.accent : presentation.deep ? colors.inboxDeepBorder : colors.border,
            shadowColor: '#1C1815',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
        }}
        className={`flex-row items-start gap-3 ${inColumn ? '' : 'mx-4'} mb-2 pl-3 pr-14 py-3 rounded-2xl active:opacity-90 ${
          selected || (!selection.mode && active) ? 'border-2 border-accent' : ''
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
          style={{ width: 64, height: 64, flexShrink: 0 }}
        >
          {hasPhoto && thumb.kind === 'image' ? (
            <Image
              source={{ uri: thumb.uri }}
              contentFit="cover"
              onError={() => setFailedUri(thumb.uri)}
              style={{ width: 64, height: 64, flexShrink: 0 }}
            />
          ) : (
            <AppIcon name={thumb.kind === 'icon' ? thumb.icon : 'link'} size={24} />
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
        <View className="flex-1 min-w-0 gap-0.5">
          <Text
            className="text-fg"
            style={{ fontFamily: 'Inter_500Medium', fontSize: 15 }}
            numberOfLines={2}
          >
            {item.title ?? item.raw_url ?? (pending ? 'Preparing saved content…' : 'Saved item')}
          </Text>
          <SemanticPreview item={item} compact />
          <Text
            className="text-muted"
            style={{ fontFamily: 'Inter_400Regular', fontSize: 12 }}
            numberOfLines={1}
          >
            {subline || item.type}
          </Text>
          {detailed && item.summary ? <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>{item.summary}</Text> : null}
          <ItemStatus item={item} selectionMode={selection.mode} />
        </View>
      </Pressable>
      {!selection.mode ? <View style={{ position: 'absolute', top: 10, right: inColumn ? 8 : 24 }}><ItemActionsMenu item={item} variant="compact" /></View> : null}
    </View>
  );
};
