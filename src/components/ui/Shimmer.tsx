import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/lib/theme';

type Props = { className?: string };

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

/**
 * Absolute-positioned overlay that slides a soft highlight left-to-right.
 * Parent must be relative + overflow:hidden. Used inside pending-state cards.
 */
export const Shimmer: React.FC<Props> = ({ className }) => {
  const { resolved } = useTheme();
  const x = useSharedValue(-1);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [x]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: `${x.value * 100}%` }],
  }));

  const colors =
    resolved === 'dark'
      ? ['transparent', 'rgba(255,255,255,0.05)', 'transparent']
      : ['transparent', 'rgba(28,24,21,0.06)', 'transparent'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} className={className}>
      <AnimatedLG
        colors={colors as unknown as readonly [string, string, string]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, style]}
      />
    </View>
  );
};
