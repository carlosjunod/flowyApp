import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React from 'react';
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
  const directUrl = r2Url(item);
  const slideUrl = item.media?.[0]?.r2_key ? r2UrlForKey(item.media[0]!.r2_key) : null;
  const videoUrl = directUrl ?? slideUrl;
  const sourceUrl = item.source_url ?? item.raw_url ?? '';
  const slideKind = item.media?.[0]?.kind;
  const isImage = slideKind === 'image' && !directUrl;

  return (
    <View>
      <View
        className="mb-3 overflow-hidden rounded-xl border border-border bg-black"
        style={{ width: '100%' }}
      >
        {videoUrl ? (
          isImage ? (
            <Image
              source={{ uri: videoUrl }}
              style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 520 }}
              contentFit="contain"
              accessibilityLabel={item.title ?? 'Reel preview'}
            />
          ) : (
            <ReelVideo uri={videoUrl} poster={directUrl} />
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
            <Text style={{ fontSize: 14 }}>📸</Text>
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
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 },
            ]}
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

      <View>
        <Text
          className="text-muted mb-2"
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Transcript
        </Text>
        <View
          className="rounded-xl border border-border bg-surface"
          style={{ padding: 14 }}
        >
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 21,
              color: colors.muted,
              fontStyle: item.content?.trim() ? 'normal' : 'italic',
              opacity: item.content?.trim() ? 1 : 0.7,
            }}
          >
            {item.content?.trim() || 'No transcript captured for this reel.'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const ReelVideo: React.FC<{ uri: string; poster?: string | null }> = ({ uri }) => {
  // expo-video v3 API: useVideoPlayer hook returns a player object passed to VideoView.
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    // Do not autoplay — Reels are loud and unexpected on detail mount.
  });

  return (
    <VideoView
      player={player}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
      style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 520, backgroundColor: '#000' }}
      contentFit="contain"
    />
  );
};

const ReelPlaceholder: React.FC<{ url: string; title?: string }> = ({ url, title }) => (
  <Pressable
    onPress={() => (url ? Linking.openURL(url) : undefined)}
    accessibilityRole="link"
    accessibilityLabel={title ? `Open ${title} on Instagram` : 'Open reel on Instagram'}
    style={({ pressed }) => [
      {
        width: '100%',
        aspectRatio: 9 / 16,
        maxHeight: 520,
        alignItems: 'center',
        justifyContent: 'center',
        // Instagram-ish gradient (single solid since RN needs LinearGradient lib for stops;
        // we keep it deliberately simple — the focus is "Watch on Instagram" affordance).
        backgroundColor: '#e1306c',
        opacity: pressed ? 0.92 : 1,
      },
    ]}
  >
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
    </View>
    <Text
      numberOfLines={2}
      style={{
        position: 'absolute',
        bottom: 14,
        left: 16,
        right: 16,
        textAlign: 'center',
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
      }}
    >
      {title ?? 'Open this reel on Instagram'}
    </Text>
  </Pressable>
);
