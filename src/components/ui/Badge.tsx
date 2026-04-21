import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  label: string;
  tone?: 'neutral' | 'accent' | 'danger' | 'success';
  className?: string;
};

const tones: Record<NonNullable<Props['tone']>, { bg: string; text: string }> = {
  neutral: { bg: 'bg-card border border-border', text: 'text-muted' },
  accent: { bg: 'bg-accent/10', text: 'text-accent' },
  danger: { bg: 'bg-danger/10', text: 'text-danger' },
  success: { bg: 'bg-success/10', text: 'text-success' },
};

export const Badge: React.FC<Props> = ({ label, tone = 'neutral', className }) => {
  const t = tones[tone];
  return (
    <View className={`rounded-full px-2 py-0.5 ${t.bg} ${className ?? ''}`}>
      <Text className={`text-xs font-medium ${t.text}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};
