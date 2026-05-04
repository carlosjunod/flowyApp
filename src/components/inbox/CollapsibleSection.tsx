import { Feather } from '@expo/vector-icons';
import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useResolvedColors } from '@/lib/theme';

type Props = {
  label: string;
  /** Optional inline icon (e.g. sparkle for AI sections) rendered next to the label. */
  trailingIcon?: ReactNode;
  /** Right-aligned pill — typically a count or "AI" tag. */
  badge?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Reusable collapsible section used throughout the item drawer.
 * Header: chevron · uppercase label · optional sparkle · right-aligned badge.
 * Mirrors `apps/web/components/inbox/CollapsibleSection.tsx`.
 */
export const CollapsibleSection: React.FC<Props> = ({
  label,
  trailingIcon,
  badge,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const colors = useResolvedColors();
  const rotate = useSharedValue(defaultOpen ? 90 : 0);

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    rotate.value = withTiming(next ? 90 : 0, { duration: 180 });
  };

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border + 'B0' }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 14,
        }}
      >
        <Animated.View style={chevStyle}>
          <Feather name="chevron-right" size={12} color={colors.muted} />
        </Animated.View>
        <Text
          style={{
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
            letterSpacing: 1.05,
            textTransform: 'uppercase',
            color: colors.muted,
          }}
        >
          {label}
        </Text>
        {trailingIcon ? <View>{trailingIcon}</View> : null}
        {badge !== undefined && badge !== null && badge !== '' ? (
          <View
            style={{
              marginLeft: 'auto',
              paddingHorizontal: 8,
              paddingVertical: 2,
              backgroundColor: colors.accent + '1A',
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontFamily: 'Inter_700Bold',
                fontSize: 10,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: colors.accent,
              }}
            >
              {String(badge)}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {open ? <View style={{ paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
};
