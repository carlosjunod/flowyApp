import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useResolvedColors } from '@/lib/theme';

/** A leftward swipe from the right edge; center swipes remain available to media. */
export function ReaderSwipe({ children, onClose, scrollGesture, disabled = false }: {
  children: React.ReactNode; onClose: () => void; scrollGesture: NativeGesture; disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const colors = useResolvedColors();
  const reducedMotion = useReducedMotion();
  const x = useSharedValue(0);
  const closing = useSharedValue(false);
  const gesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .simultaneousWithExternalGesture(scrollGesture)
    .hitSlop({ right: 0, width: 28 })
    .activeOffsetX(-12)
    .failOffsetY([-12, 12])
    .maxPointers(1)
    .onUpdate(event => { if (!closing.value) x.value = Math.min(0, event.translationX); })
    .onEnd(event => {
      const complete = -event.translationX >= Math.min(120, width * .28)
        || (-event.translationX >= 48 && event.velocityX < -650);
      if (!complete || closing.value) return;
      closing.value = true;
      x.value = withTiming(-width, { duration: reducedMotion ? 0 : 200, easing: Easing.out(Easing.cubic) }, finished => {
        if (finished) runOnJS(onClose)();
      });
    })
    .onFinalize(() => {
      if (!closing.value) x.value = withTiming(0, { duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.cubic) });
    }), [disabled, width, reducedMotion, onClose, scrollGesture, x, closing]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={[styles.fill, { backgroundColor: colors.bg }]}>
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
    </GestureDetector>
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
