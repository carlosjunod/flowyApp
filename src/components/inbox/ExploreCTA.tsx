import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';


import { Shimmer } from '@/components/ui/Shimmer';
import { useResolvedColors } from '@/lib/theme';
import type { ItemExploration } from '@/types';

type Props = {
  exploration?: ItemExploration;
  isReceipt?: boolean;
  /**
   * Starts the server exploration action for the item.
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
 * Displays the actual exploration state. Motion is reserved for active work.
 */
export const ExploreCTA: React.FC<Props> = ({ exploration, isReceipt, onPress }) => {
  const colors = useResolvedColors();
  const variant = pickVariant(exploration);

  // ── Per-variant style + icon resolution ──
  let bg = colors.accent;
  let fg: string = colors.onAccent;
  let borderColor: string | null = null;
  let label = isReceipt ? 'Analyze this receipt' : 'Find related sources';
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
    fg = colors.onAccent;
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

  return (
    <View style={{ borderRadius: 14 }}>
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
    </View>
  );
};
