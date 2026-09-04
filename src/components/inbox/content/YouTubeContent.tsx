import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useResolvedColors } from '@/lib/theme';
import { extractYoutubeId } from '@/lib/thumbnails';
import {
  parseTimestampedSegments,
  youtubeUrlAtSecond,
  type TimestampedSegment,
} from '@/lib/transcript';
import type { Item } from '@/types';

import { ContentTabs } from './GenericContent';

type Tab = 'chapters' | 'transcript';

/**
 * YouTube renderer — thumbnail that taps to embed a WebView (we avoid loading
 * the iframe until the user opts in, matching web), channel info bar, and a
 * Chapters / Transcript tab group.
 *
 * Chapter / segmented-transcript data depends on the worker preserving
 * timestamps. Today the YouTube processor flattens transcripts to a single
 * joined string, so most items render as plain text with a graceful
 * "No chapters extracted" state.
 *
 * Mirrors apps/web/components/inbox/content/YouTubeContent.tsx.
 */
export const YouTubeContent: React.FC<{ item: Item }> = ({ item }) => {
  const url = item.source_url ?? item.raw_url ?? '';
  const videoId = url ? extractYoutubeId(url) : null;
  const [embedded, setEmbedded] = useState(false);

  const segments = useMemo(
    () => parseTimestampedSegments(item.content),
    [item.content],
  );
  const hasSegments = !!segments && segments.length >= 2;

  return (
    <View>
      <VideoArea
        videoId={videoId}
        url={url}
        embedded={embedded}
        onPlay={() => setEmbedded(true)}
        ogImage={item.og_image}
        title={item.title}
      />
      <ChannelBar item={item} url={url} />
      <ChaptersTranscript
        segments={segments}
        hasSegments={hasSegments}
        content={item.content ?? ''}
        url={url}
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Video area — thumbnail → WebView
// ─────────────────────────────────────────────────────────────

const VideoArea: React.FC<{
  videoId: string | null;
  url: string;
  embedded: boolean;
  onPlay: () => void;
  ogImage?: string;
  title?: string;
}> = ({ videoId, url, embedded, onPlay, ogImage, title }) => {
  // `hqdefault` is always available; `maxresdefault` sometimes 404s.
  const thumb = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : ogImage ?? null;

  if (embedded && videoId) {
    return (
      <View
        className="mb-3 overflow-hidden rounded-xl border border-border bg-black"
        style={{ aspectRatio: 16 / 9, width: '100%' }}
      >
        {/* This WebView runs JavaScript with DOM storage, so it must not be
            allowed to wander. Without a navigation policy, an ad, an end-card,
            a redirect or a sign-in flow inside the embed can take it anywhere
            while keeping those privileges. Player traffic stays inside; every
            user-initiated navigation leaves for the real browser. */}
        <WebView
          source={{ uri: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1` }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          // Permissive whitelist ON PURPOSE: react-native-webview applies
          // originWhitelist *before* onShouldStartLoadWithRequest and cancels
          // non-matching requests itself. A narrow list therefore never lets
          // the callback decide, and silently breaks the player's own consent
          // and auxiliary frames. The callback below is the real policy.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(req) => {
            // iOS reports real frame status, so sub-frames (googlevideo, ytimg,
            // consent) pass untouched. Android never raises this for inner
            // frames at all, so only top-level navigations arrive there.
            if (req.isTopFrame === false) return true;
            const allowed =
              req.url.startsWith('https://www.youtube.com/embed/') ||
              req.url.startsWith('https://www.youtube-nocookie.com/embed/') ||
              req.url === 'about:blank';
            if (!allowed) {
              void Linking.openURL(req.url);
              return false;
            }
            return true;
          }}
          style={{ flex: 1, backgroundColor: 'black' }}
        />
      </View>
    );
  }

  const handlePress = () => {
    if (videoId) onPlay();
    else if (url) Linking.openURL(url);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel="Play video"
      accessibilityRole="button"
      className="mb-3 overflow-hidden rounded-xl border border-border bg-black"
      style={({ pressed }) => [
        {
          aspectRatio: 16 / 9,
          width: '100%',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityLabel={title ?? 'YouTube thumbnail'}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Feather name="play" size={48} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      {/* Center play button */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.9)',
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
        </View>
      </View>
      {/* YouTube-red progress sliver */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: '#27272a',
        }}
      >
        <View style={{ width: '28%', height: '100%', backgroundColor: '#dc2626' }} />
      </View>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Channel bar
// ─────────────────────────────────────────────────────────────

const ChannelBar: React.FC<{ item: Item; url: string }> = ({ item, url }) => {
  const colors = useResolvedColors();
  const channelName =
    item.exploration?.primary_link?.title || item.site_name || 'YouTube channel';
  const initial = channelName.charAt(0).toUpperCase();

  return (
    <View
      className="mb-4 flex-row items-center gap-2.5 rounded-xl bg-surface"
      style={{ paddingHorizontal: 12, paddingVertical: 10 }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          // YouTube-red gradient feel — solid red since we don't pull in another lib
          backgroundColor: '#cc0000',
        }}
      >
        <Text
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' }}
        >
          {initial}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          className="text-fg"
          numberOfLines={1}
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13 }}
        >
          {channelName}
        </Text>
        <Text
          className="text-muted"
          numberOfLines={1}
          style={{ fontFamily: 'Inter_400Regular', fontSize: 11 }}
        >
          on YouTube
        </Text>
      </View>
      {url ? (
        <Pressable
          onPress={() => Linking.openURL(url)}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel="Watch on YouTube"
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
            Watch on YouTube
          </Text>
          <Feather name="arrow-up-right" size={11} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Chapters / Transcript tabs
// ─────────────────────────────────────────────────────────────

const ChaptersTranscript: React.FC<{
  segments: TimestampedSegment[] | null;
  hasSegments: boolean;
  content: string;
  url: string;
}> = ({ segments, hasSegments, content, url }) => {
  const [tab, setTab] = useState<Tab>(hasSegments ? 'chapters' : 'transcript');

  return (
    <View>
      <ContentTabs
        tabs={[
          { id: 'chapters', label: 'Chapters' },
          { id: 'transcript', label: 'Transcript' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'chapters' ? (
        <ChapterList segments={segments} url={url} />
      ) : (
        <TranscriptView segments={segments} content={content} url={url} />
      )}
    </View>
  );
};

const ChapterList: React.FC<{
  segments: TimestampedSegment[] | null;
  url: string;
}> = ({ segments, url }) => {
  const colors = useResolvedColors();
  if (!segments || segments.length < 2) {
    return (
      <View
        className="rounded-xl border border-border bg-surface"
        style={{ padding: 14 }}
      >
        <Text
          style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            fontStyle: 'italic',
            color: colors.muted,
            opacity: 0.75,
          }}
        >
          📍 No chapters extracted for this video.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {segments.map((seg, i) => {
        const isActive = i === 0;
        return (
          <Pressable
            key={`${seg.time}-${i}`}
            onPress={() =>
              url ? Linking.openURL(youtubeUrlAtSecond(url, seg.seconds)) : undefined
            }
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: isActive
                  ? colors.accent + '1A' // ~10% alpha
                  : pressed
                    ? colors.surface
                    : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                minWidth: 38,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 11,
                color: isActive ? colors.accent : colors.muted,
              }}
            >
              {seg.time}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
                fontSize: 13,
                lineHeight: 18,
                color: isActive ? colors.fg : colors.muted,
              }}
            >
              {seg.text}
            </Text>
            {isActive ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const TranscriptView: React.FC<{
  segments: TimestampedSegment[] | null;
  content: string;
  url: string;
}> = ({ segments, content, url }) => {
  const colors = useResolvedColors();

  if (segments && segments.length >= 2) {
    return (
      <ScrollView style={{ maxHeight: 360 }} nestedScrollEnabled>
        {segments.map((seg, i) => (
          <Pressable
            key={`${seg.time}-${i}`}
            onPress={() =>
              url ? Linking.openURL(youtubeUrlAtSecond(url, seg.seconds)) : undefined
            }
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 6,
                backgroundColor: pressed ? colors.surface : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                minWidth: 38,
                paddingTop: 2,
                fontFamily: 'Inter_600SemiBold',
                fontSize: 11,
                color: colors.accent,
              }}
            >
              {seg.time}
            </Text>
            <Text
              style={{
                flex: 1,
                fontFamily: 'Inter_400Regular',
                fontSize: 13,
                lineHeight: 20,
                color: colors.muted,
              }}
            >
              {seg.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
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
          fontStyle: content ? 'normal' : 'italic',
          opacity: content ? 1 : 0.75,
        }}
      >
        {content || '✨ No transcript captured yet.'}
      </Text>
    </View>
  );
};
