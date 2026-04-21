import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';

type Tone = 'neutral' | 'accent' | 'danger' | 'success';

type Props = {
  label: string;
  tone?: Tone;
  /** When set, picks a deterministic color pair from the category palette. Overrides tone. */
  palette?: string | null;
  className?: string;
};

const tones: Record<Tone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-card border border-border', text: 'text-muted' },
  accent: { bg: 'bg-accent/10', text: 'text-accent' },
  danger: { bg: 'bg-danger/10', text: 'text-danger' },
  success: { bg: 'bg-success/10', text: 'text-success' },
};

// Hash function must match web's ItemCard.categoryColor() byte-for-byte so
// a given category string yields the same color on both platforms.
const paletteColors = {
  light: [
    { bg: '#FFE4E6', text: '#9F1239' }, // rose
    { bg: '#FEF3C7', text: '#92400E' }, // amber
    { bg: '#D1FAE5', text: '#065F46' }, // emerald
    { bg: '#E0F2FE', text: '#075985' }, // sky
    { bg: '#EDE9FE', text: '#5B21B6' }, // violet
    { bg: '#FAE8FF', text: '#86198F' }, // fuchsia
  ],
  dark: [
    { bg: 'rgba(244,63,94,0.15)', text: '#FECDD3' }, // rose
    { bg: 'rgba(245,158,11,0.15)', text: '#FDE68A' }, // amber
    { bg: 'rgba(16,185,129,0.15)', text: '#A7F3D0' }, // emerald
    { bg: 'rgba(14,165,233,0.15)', text: '#BAE6FD' }, // sky
    { bg: 'rgba(139,92,246,0.15)', text: '#DDD6FE' }, // violet
    { bg: 'rgba(217,70,239,0.15)', text: '#F5D0FE' }, // fuchsia
  ],
} as const;

const hashCategory = (s: string): number => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash % 6;
};

export const Badge: React.FC<Props> = ({ label, tone = 'neutral', palette, className }) => {
  const { resolved } = useTheme();
  if (palette) {
    const colors = paletteColors[resolved][hashCategory(palette)];
    if (colors) {
      return (
        <View
          className={`rounded-full px-2 py-0.5 ${className ?? ''}`}
          style={{ backgroundColor: colors.bg }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: colors.text }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      );
    }
  }
  const t = tones[tone];
  return (
    <View className={`rounded-full px-2 py-0.5 ${t.bg} ${className ?? ''}`}>
      <Text className={`text-xs font-medium ${t.text}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};
