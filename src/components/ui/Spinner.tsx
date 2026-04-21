import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Props = { size?: 'small' | 'large'; className?: string; tint?: 'accent' | 'muted' };

export const Spinner: React.FC<Props> = ({ size = 'small', className, tint = 'accent' }) => {
  const colors = useResolvedColors();
  return (
    <View className={`items-center justify-center ${className ?? ''}`}>
      <ActivityIndicator size={size} color={tint === 'accent' ? colors.accent : colors.muted} />
    </View>
  );
};
