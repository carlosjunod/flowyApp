import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/lib/theme';

type Props = { className?: string };

export const ThemeToggle: React.FC<Props> = ({ className }) => {
  const { theme, resolved, toggle } = useTheme();
  const iconColor = resolved === 'dark' ? '#EEEAE0' : '#1C1815';

  const name: keyof typeof Feather.glyphMap =
    theme === 'system' ? 'monitor' : theme === 'dark' ? 'moon' : 'sun';

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${theme}. Tap to change.`}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      className={`h-9 w-9 items-center justify-center rounded-full ${className ?? ''}`}
    >
      <Feather name={name} size={18} color={iconColor} />
    </Pressable>
  );
};
