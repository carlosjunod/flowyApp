import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Keyboard, Modal, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResolvedColors } from '@/lib/theme';

/** Left-edge conversation drawer; dragging left follows the finger and dismisses. */
export function ChatHistoryDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useResolvedColors();
  const drawerWidth = Math.min(320, width * 0.86);
  const progress = useRef(new Animated.Value(0)).current;
  const [present, setPresent] = useState(open);
  const reducedMotion = useRef(false);
  const dragStart = useRef(1);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) reducedMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reducedMotion.current = value; });
    return () => { live = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (open) {
      Keyboard.dismiss();
      setPresent(true);
    } else {
      Animated.timing(progress, { toValue: 0, duration: reducedMotion.current ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setPresent(false); });
    }
    return () => progress.stopAnimation();
  }, [open, progress]);

  const show = useCallback(() => Animated.timing(progress, { toValue: 1, duration: reducedMotion.current ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(), [progress]);
  // Animate reopening even if an interrupted closing transition kept the modal mounted.
  useEffect(() => { if (open && present) show(); }, [open, present, show]);
  const pan = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderGrant: () => progress.stopAnimation(value => { dragStart.current = value; }),
    onPanResponderMove: (_, gesture) => progress.setValue(Math.max(0, Math.min(1, dragStart.current + gesture.dx / drawerWidth))),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -drawerWidth * 0.25 || gesture.vx < -0.5) closeRef.current();
      else show();
    },
    onPanResponderTerminate: show,
  }), [drawerWidth, progress, show]);

  return (
    <Modal visible={present} transparent animationType="none" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat history" />
        </Animated.View>
        <Animated.View {...pan.panHandlers} accessibilityViewIsModal onAccessibilityEscape={onClose}
          style={[styles.panel, { width: drawerWidth, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.surface, borderRightColor: colors.border,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  panel: { height: '100%', borderRightWidth: StyleSheet.hairlineWidth },
});
