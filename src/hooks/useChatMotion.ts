import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

export function useChatMotion() {
  const [reduced, setReduced] = useState(true);
  const [screenReader, setScreenReader] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true;
    let motionEvent = false;
    let readerEvent = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { motionEvent = true; setReduced(value); });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', value => { readerEvent = true; setScreenReader(value); });
    const app = AppState.addEventListener('change', value => setForeground(value === 'active'));
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !motionEvent) setReduced(value); }).catch(() => {});
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (live && !readerEvent) setScreenReader(value); }).catch(() => {});
    return () => { live = false; motion.remove(); reader.remove(); app.remove(); };
  }, []);
  return foreground && !reduced && !screenReader;
}
