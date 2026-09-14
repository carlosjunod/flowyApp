import { savedMediaKind } from '@/types/reader';
import { SourceText } from './SourceText';
import { AppIcon } from '@/components/ui/AppIcon';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { CollapsibleSection } from '../CollapsibleSection';
import { Linking, Pressable, Text, View } from 'react-native';

import { ENV } from '@/lib/env';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';

function r2UrlForKey(key?: string): string | null {
  if (!key) return null;
  return `${ENV.R2_PUBLIC_URL}/${key}`;
}

function r2Url(item: Item): string | null {
  return r2UrlForKey(item.r2_key);
}

/**
 * Instagram Reel renderer — 9:16 video viewer when R2 media is available, with
 * a styled IG-gradient placeholder fallback. Includes a "Watch on Instagram"
 * deep link and the Whisper-extracted transcript.
 *
 * Mirrors apps/web/components/inbox/content/ReelContent.tsx.
 */
export const ReelContent: React.FC<{ item: Item }> = ({ item }) => {
  const colors = useResolvedColors();
  const [failed, setFailed] = useState(false);
  const directUrl = r2Url(item);
  const slideUrl = item.media?.[0]?.r2_key ? r2UrlForKey(item.media[0]!.r2_key) : null;
  const videoUrl = directUrl ?? slideUrl;
  const sourceUrl = item.source_url ?? item.raw_url ?? '';
  const slideKind = item.media?.[0]?.kind;
  const key = item.r2_key ?? item.media?.[0]?.r2_key;
  const kind = savedMediaKind(key);
  const isImage = kind === 'image' || (kind === 'unknown' && slideKind !== 'video');

  return (
    <View>
      <View
        className="mb-3 overflow-hidden rounded-xl border border-border bg-black"
        style={{ width: '100%' }}
      >
        {videoUrl && !failed ? (
          isImage ? (
            <Image
              source={{ uri: videoUrl }}
              style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 320 }}
              onError={() => setFailed(true)}
              contentFit="contain"
              accessibilityLabel={item.title ?? 'Reel preview'}
            />
          ) : (
            <ReelVideo uri={videoUrl} onError={() => setFailed(true)} />
          )
        ) : (
          <ReelPlaceholder url={sourceUrl} title={item.title} />
        )}
      </View>

      {sourceUrl ? (
        <View
          className="mb-4 flex-row items-center justify-between rounded-xl bg-surface"
          style={{ paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppIcon name="instagram" size={14} />
            <Text
              className="text-fg"
              style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12.5 }}
            >
              Instagram Reel
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(sourceUrl)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Watch on Instagram"
            className="active:opacity-80"
            style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 }}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 11,
                color: colors.accent,
              }}
            >
              Watch on Instagram
            </Text>
            <Feather name="arrow-up-right" size={11} color={colors.accent} />
          </Pressable>
        </View>
      ) : null}

      {item.content?.trim() ? <CollapsibleSection label="Saved text" defaultOpen={false}><SourceText text={item.content} /></CollapsibleSection> : null}
    </View>
  );
};

const ReelVideo: React.FC<{ uri: string; onError: () => void }> = ({ uri, onError }) => {
  // expo-video v3 API: useVideoPlayer hook returns a player object passed to VideoView.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    // Do not autoplay — Reels are loud and unexpected on detail mount.
  });

  useEffect(() => { const subscription = player.addListener('statusChange', event => { if (event.status === 'error') onError(); }); return () => subscription.remove(); }, [player, onError]);
  return (
    <VideoView
      player={player}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
      style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 320, backgroundColor: '#000' }}
      contentFit="contain"
    />
  );
};

const ReelPlaceholder: React.FC<{ url: string; title?: string }> = ({ url, title }) => {
  const colors = useResolvedColors();
  return <Pressable onPress={() => url ? Linking.openURL(url) : undefined} disabled={!url} accessibilityRole="link" accessibilityLabel="Watch on Instagram" className="active:opacity-80 bg-surface" style={{ width: '100%', height: 160, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
    <Feather name="external-link" size={24} color={colors.accent} />
    <Text style={{ color: colors.fg, textAlign: 'center', fontSize: 14 }}>{title ?? 'Open this reel on Instagram'}</Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Preview unavailable · Watch on Instagram</Text>
  </Pressable>;
};
