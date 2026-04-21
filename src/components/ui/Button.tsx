import React from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

const base = 'rounded-xl items-center justify-center px-4 h-11 active:opacity-80';

const variants: Record<Variant, { container: string; text: string; spinner: string }> = {
  primary: {
    container: 'bg-accent',
    text: 'text-white font-semibold',
    spinner: '#ffffff',
  },
  secondary: {
    container: 'bg-card border border-border',
    text: 'text-fg font-semibold',
    spinner: '#0f172a',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-accent font-semibold',
    spinner: '#6366f1',
  },
  danger: {
    container: 'bg-danger',
    text: 'text-white font-semibold',
    spinner: '#ffffff',
  },
};

export const Button: React.FC<Props> = ({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...rest
}) => {
  const v = variants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      className={`${base} ${v.container} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <Text className={v.text}>{title}</Text>
      )}
    </Pressable>
  );
};
