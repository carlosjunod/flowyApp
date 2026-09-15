import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResolvedColors } from '@/lib/theme';

export function StorageAction({
  title,
  label,
  icon,
  onPress,
  disabled,
  expanded,
  selected,
  tone = 'quiet',
  children,
}: {
  title?: string;
  label?: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  tone?: 'quiet' | 'action' | 'primary' | 'danger';
  children?: ReactNode;
}) {
  const colors = useResolvedColors();
  const color =
    tone === 'primary'
      ? colors.bg
      : tone === 'danger'
        ? colors.danger
        : tone === 'action'
          ? colors.accent
          : colors.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label || title}
      accessibilityState={{ disabled, expanded, selected }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[44px] min-w-[44px] flex-row items-center justify-center gap-2 rounded-lg px-3 py-2.5 active:opacity-70"
      style={{
        opacity: disabled ? 0.4 : 1,
        backgroundColor:
          tone === 'primary' ? colors.fg : selected ? colors.bg : 'transparent',
      }}
    >
      {icon ? (
        <Feather accessible={false} name={icon} size={17} color={color} />
      ) : null}
      {title ? (
        <Text
          style={{
            color,
            fontFamily: 'Inter_500Medium',
            fontSize: 14,
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </Pressable>
  );
}
