import React from 'react';
import { ActivityIndicator, View } from 'react-native';

type Props = { size?: 'small' | 'large'; className?: string };

export const Spinner: React.FC<Props> = ({ size = 'small', className }) => (
  <View className={`items-center justify-center ${className ?? ''}`}>
    <ActivityIndicator size={size} color="#6366f1" />
  </View>
);
