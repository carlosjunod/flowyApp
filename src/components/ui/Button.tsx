import React from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

const base = 'rounded-xl items-center justify-center px-4 h-11';

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-primary', text: 'text-bg font-semibold' },
  accent: { container: 'bg-accent shadow-card', text: 'text-white font-semibold' },
  secondary: { container: 'bg-card border border-border', text: 'text-fg font-semibold' },
  ghost: { container: 'bg-transparent', text: 'text-accent font-semibold' },
  danger: { container: 'bg-transparent border border-danger', text: 'text-danger font-semibold' },
};

export const Button: React.FC<Props> = ({
  title,
  variant = 'accent',
  loading = false,
  disabled,
  className,
  ...rest
}) => {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  const colors = useResolvedColors();
  const spinnerColor =
    variant === 'secondary' ? colors.fg : variant === 'ghost' ? colors.accent : '#FFFFFF';
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        pressed && !isDisabled && { transform: [{ scale: 0.98 }], opacity: 0.96 },
      ]}
      className={`${base} ${v.container} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text className={v.text}>{title}</Text>
      )}
    </Pressable>
  );
};
