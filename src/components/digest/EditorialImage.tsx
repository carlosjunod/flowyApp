import { Image } from 'expo-image';
import React, { useState } from 'react';
import { PixelRatio, Text, View } from 'react-native';

import { AI_ILLUSTRATION_LABEL, pickVariant } from '@/lib/digestEditorial';
import type { DigestEditorialImage } from '@/types';

type Props = {
  image: DigestEditorialImage;
  locale: 'en' | 'es';
  /** Layout width in points, used to request an adequate (never upscaled) variant. */
  width: number;
  caption?: boolean;
  radius?: number;
  onUnavailable?: () => void;
};

/**
 * Stable 3:2 frame for a published editorial illustration. Natural colors in both
 * themes (no tint), focal-point cropping, localized alt text and a discreet AI label.
 * A failed load removes the figure so the report stays readable.
 */
export function EditorialImage({ image, locale, width, caption = true, radius = 8, onUnavailable }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const variant = pickVariant(image, Math.round(width * PixelRatio.get()));
  return (
    <View>
      <View className="overflow-hidden bg-surface" style={{ width: '100%', aspectRatio: 3 / 2, borderRadius: radius }}>
        <Image
          source={{ uri: variant.url, width: variant.w, height: variant.h }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          contentPosition={{ left: `${Math.round(image.focal_point.x * 100)}%`, top: `${Math.round(image.focal_point.y * 100)}%` }}
          transition={150}
          accessible
          accessibilityLabel={image.alt[locale]}
          onError={() => {
            setFailed(true);
            onUnavailable?.();
          }}
        />
      </View>
      {caption ? <Text className="mt-2 text-xs text-muted">{AI_ILLUSTRATION_LABEL[locale]}</Text> : null}
    </View>
  );
}
