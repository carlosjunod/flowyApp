import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ENV } from '@/lib/env';
import { useResolvedColors } from '@/lib/theme';
import type { Item, MediaSlide } from '@/types';

function r2UrlForKey(key?: string): string | null {
  if (!key) return null;
  return `${ENV.R2_PUBLIC_URL}/${key}`;
}

const PLACEHOLDER_HUES = [22, 200, 162, 320, 50, 270, 12, 110] as const;
function placeholderColor(idx: number): string {
  const h = PLACEHOLDER_HUES[idx % PLACEHOLDER_HUES.length]!;
  return `hsl(${h}, 55%, 28%)`;
}

const SLIDE_EMOJIS = ['🖼', '✨', '📷', '🎞', '🌀', '💡', '🎨', '📐'] as const;

/**
 * Instagram Carousel renderer — one main slide at a time with prev/next nav,
 * dot indicators, a thumbnail strip, and an "AI Vision" panel showing Claude's
 * per-slide description (already populated by the Instagram processor into
 * `media[i].summary`). Video slides use expo-video.
 *
 * Mirrors apps/web/components/inbox/content/CarouselContent.tsx.
 */
export const CarouselContent: React.FC<{ item: Item }> = ({ item }) => {
  const colors = useResolvedColors();
  const slides = (item.media ?? []).slice().sort((a, b) => a.index - b.index);
  const [idx, setIdx] = useState(0);
  const [showAI, setShowAI] = useState(true);

  if (!slides.length) {
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
            opacity: 0.7,
          }}
        >
          No slides found for this carousel.
        </Text>
      </View>
    );
  }

  const active = slides[idx] ?? slides[0]!;
  const count = slides.length;
  const go = (delta: number) => setIdx((i) => (i + delta + count) % count);

  return (
    <View>
      <MainSlide
        slide={active}
        idx={idx}
        count={count}
        onPrev={idx > 0 ? () => go(-1) : null}
        onNext={idx < count - 1 ? () => go(1) : null}
      />

      {/* Dot indicators */}
      <View
        className="flex-row items-center justify-center"
        style={{ gap: 6, marginTop: 8, marginBottom: 12 }}
      >
        {slides.map((s, i) => {
          const isActive = i === idx;
          return (
            <Pressable
              key={`dot-${s.index}-${i}`}
              onPress={() => setIdx(i)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1}`}
            >
              <View
                style={{
                  width: isActive ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isActive ? colors.accent : colors.border,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Thumbnail strip */}
      <ThumbnailStrip slides={slides} activeIdx={idx} onSelect={setIdx} />

      {/* AI Vision toggle + panel */}
      <Pressable
        onPress={() => setShowAI((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showAI }}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: showAI ? colors.accent + '99' : colors.border,
            backgroundColor: showAI ? colors.accent + '14' : colors.surface,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderBottomLeftRadius: showAI ? 0 : 10,
            borderBottomRightRadius: showAI ? 0 : 10,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="star" size={11} color={showAI ? colors.accent : colors.muted} />
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            color: showAI ? colors.accent : colors.muted,
          }}
        >
          AI Vision — Slide {idx + 1}
        </Text>
        <View style={{ marginLeft: 'auto' }}>
          <Feather
            name={showAI ? 'chevron-down' : 'chevron-right'}
            size={11}
            color={showAI ? colors.accent : colors.muted}
          />
        </View>
      </Pressable>
      {showAI ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: colors.accent + '99',
            backgroundColor: colors.accent + '0F',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              lineHeight: 21,
              color: colors.muted,
              fontStyle: active.summary ? 'normal' : 'italic',
              opacity: active.summary ? 1 : 0.7,
            }}
          >
            {active.summary || 'No vision description yet for this slide.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Main slide
// ─────────────────────────────────────────────────────────────

const MainSlide: React.FC<{
  slide: MediaSlide;
  idx: number;
  count: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}> = ({ slide, idx, count, onPrev, onNext }) => {
  const { width } = useWindowDimensions();
  const url = r2UrlForKey(slide.r2_key);
  const containerSize = width - 32; // detail screen has 16px horizontal padding

  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-black"
      style={{ position: 'relative' }}
    >
      <View
        style={{
          width: '100%',
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: url ? '#000' : placeholderColor(idx),
        }}
      >
        {url ? (
          slide.kind === 'video' ? (
            <SlideVideo uri={url} keyId={slide.r2_key} size={containerSize} />
          ) : (
            <Image
              source={{ uri: url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              transition={150}
              accessibilityLabel={slide.summary ?? `Slide ${idx + 1} of ${count}`}
            />
          )
        ) : (
          <PlaceholderSlide idx={idx} />
        )}

        {/* Counter badge */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 11,
              color: '#fff',
            }}
          >
            {idx + 1}/{count}
          </Text>
        </View>

        {/* Prev/Next nav — videos own their controls, so hide on video slides */}
        {slide.kind !== 'video' && onPrev ? (
          <Pressable
            onPress={onPrev}
            accessibilityLabel="Previous slide"
            hitSlop={6}
            style={({ pressed }) => [
              {
                position: 'absolute',
                top: '50%',
                left: 8,
                marginTop: -16,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="chevron-left" size={16} color="#fff" />
          </Pressable>
        ) : null}
        {slide.kind !== 'video' && onNext ? (
          <Pressable
            onPress={onNext}
            accessibilityLabel="Next slide"
            hitSlop={6}
            style={({ pressed }) => [
              {
                position: 'absolute',
                top: '50%',
                right: 8,
                marginTop: -16,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="chevron-right" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const SlideVideo: React.FC<{ uri: string; keyId?: string; size: number }> = ({ uri, size }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      nativeControls
      allowsFullscreen
      allowsPictureInPicture
      style={{ width: size, height: size, backgroundColor: '#000' }}
      contentFit="contain"
    />
  );
};

const PlaceholderSlide: React.FC<{ idx: number }> = ({ idx }) => (
  <View style={{ alignItems: 'center', gap: 8 }}>
    <Text style={{ fontSize: 40 }}>{SLIDE_EMOJIS[idx % SLIDE_EMOJIS.length]}</Text>
    <Text
      style={{
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.75)',
      }}
    >
      Slide {idx + 1}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Thumbnail strip
// ─────────────────────────────────────────────────────────────

const ThumbnailStrip: React.FC<{
  slides: MediaSlide[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}> = ({ slides, activeIdx, onSelect }) => {
  const colors = useResolvedColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 4, paddingBottom: 12 }}
    >
      {slides.map((s, i) => {
        const url = r2UrlForKey(s.r2_key);
        const isActive = i === activeIdx;
        const emoji = SLIDE_EMOJIS[i % SLIDE_EMOJIS.length];
        return (
          <Pressable
            key={`thumb-${s.index}-${s.r2_key ?? i}`}
            onPress={() => onSelect(i)}
            accessibilityLabel={`Slide ${i + 1}`}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [
              {
                width: 48,
                height: 48,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: isActive ? colors.accent : 'transparent',
                opacity: pressed ? 0.85 : isActive ? 1 : 0.6,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: url ? colors.surface : placeholderColor(i),
              },
            ]}
          >
            {url ? (
              s.kind === 'video' ? (
                <Text style={{ fontSize: 18 }}>🎬</Text>
              ) : (
                <Image
                  source={{ uri: url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              )
            ) : (
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
