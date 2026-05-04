import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Shimmer } from '@/components/ui/Shimmer';
import { useResolvedColors } from '@/lib/theme';
import type { ItemExploration } from '@/types';

type Props = {
  exploration?: ItemExploration;
  isReceipt?: boolean;
  /**
   * Tap handler. Visual stub for now — wire to a deep-dive mutation when the
   * mobile API gains `actions.exploreMany([id], { deep: true })`.
   */
  onPress?: () => void;
};

type Variant = 'idle' | 'exploring' | 'offerDeepDive' | 'fullyDone' | 'error';

const pickVariant = (exploration: ItemExploration | undefined): Variant => {
  const status = exploration?.status;
  if (status === 'exploring') return 'exploring';
  if (status === 'error') return 'error';
  if (status === 'enriched') {
    return exploration?.deep_analysis ? 'fullyDone' : 'offerDeepDive';
  }
  return 'idle';
};

/**
 * 5-state CTA mirroring the webapp's ExploreCTA. Items now arrive auto-enriched,
 * so the button's primary job is the "Deep dive" — fetching + synthesizing
 * the discovered links. Visual stub for now; wire onPress when the mutation lands.
 */
export const ExploreCTA: React.FC<Props> = ({ exploration, isReceipt, onPress }) => {
  const colors = useResolvedColors();
  const variant = pickVariant(exploration);

  // Pulse halo only on solid-accent states (idle, offerDeepDive). Skipped on
  // exploring/fullyDone/error since those have their own visual treatment.
  const isPulsing = variant === 'idle' || variant === 'offerDeepDive';
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isPulsing) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => {
      cancelAnimation(pulse);
    };
  }, [isPulsing, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.014 }],
    shadowOpacity: 0.18 + pulse.value * 0.22,
  }));

  // ── Per-variant style + icon resolution ──
  let bg = colors.accent;
  let fg = '#FFFFFF';
  let borderColor: string | null = null;
  let label = isReceipt ? 'Analyze & Enrich' : 'Explore & Enrich';
  let disabled = false;
  let showShimmer = false;
  let renderIcon: () => React.ReactElement = () => (
    <MaterialCommunityIcons name="creation" size={14} color={fg} />
  );

  if (variant === 'exploring') {
    bg = colors.accent + '1A';
    fg = colors.accent;
    borderColor = colors.accent + '4D';
    label = isReceipt ? 'Analyzing receipt…' : 'Enriching with AI…';
    disabled = true;
    showShimmer = true;
    renderIcon = () => (
      <MaterialCommunityIcons name="creation" size={14} color={fg} />
    );
  } else if (variant === 'offerDeepDive') {
    bg = colors.accent;
    fg = '#FFFFFF';
    label = 'Deep dive into links';
    renderIcon = () => (
      <MaterialCommunityIcons name="creation" size={14} color={fg} />
    );
  } else if (variant === 'fullyDone') {
    bg = colors.success + '1A';
    fg = colors.success;
    borderColor = colors.success + '4D';
    label = isReceipt ? 'Analyzed' : 'Deeply analyzed';
    disabled = true;
    renderIcon = () => <Feather name="check" size={14} color={fg} />;
  } else if (variant === 'error') {
    bg = colors.accent + '1A';
    fg = colors.accent;
    borderColor = colors.accent + '4D';
    label = isReceipt ? 'Retry analysis' : 'Retry exploration';
    renderIcon = () => <Feather name="rotate-ccw" size={14} color={fg} />;
  }

  // Shadow only renders on iOS — animating elevation on Android stutters and
  // looks worse than a static card. Android relies on the scale breathe alone.
  const haloShadow = Platform.OS === 'ios' && isPulsing
    ? {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 16,
      }
    : null;

  return (
    <Animated.View
      style={[
        { borderRadius: 14 },
        haloShadow,
        isPulsing ? haloStyle : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 44,
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 14,
            backgroundColor: bg,
            borderWidth: borderColor ? 1 : 0,
            borderColor: borderColor ?? 'transparent',
            overflow: 'hidden',
            opacity: pressed && !disabled ? 0.94 : 1,
          },
        ]}
        hitSlop={4}
      >
        {showShimmer ? <Shimmer /> : null}
        {renderIcon()}
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            color: fg,
            letterSpacing: 0.1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};
