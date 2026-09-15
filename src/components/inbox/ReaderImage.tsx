import React from 'react';
import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Independent full-size layers avoid Yoga shrinking a 9:16 image to the left. */
export function ReaderImage({ uri, label, style, onError }: {
  uri: string; label?: string; style?: StyleProp<ViewStyle>; onError?: () => void;
}) {
  const fill = { position: 'absolute' as const, top: 0, left: 0, width: '100%' as const, height: '100%' as const };
  return <View style={[{ width: '100%', height: '100%', overflow: 'hidden' }, style]}>
    <Image source={{ uri }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ ...fill, transform: [{ scale: 1.1 }], opacity: 0.75 }}
      contentFit="cover" contentPosition="center" blurRadius={18} recyclingKey={`backdrop:${uri}`} />
    <Image source={{ uri }} accessibilityLabel={label} style={fill}
      contentFit="contain" contentPosition="center" onError={onError} recyclingKey={uri} />
  </View>;
}
