import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useResolvedColors } from '@/lib/theme';

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
};

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const colors = useResolvedColors();

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const canSend = !disabled && !!value.trim();

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-bg px-4 py-3">
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask about your inbox…"
        placeholderTextColor={colors.muted}
        multiline
        className="flex-1 min-h-[44px] max-h-32 rounded-xl border border-border bg-card px-3 py-2 text-fg"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        style={({ pressed }) => [
          pressed && canSend && { transform: [{ scale: 0.97 }], opacity: 0.92 },
        ]}
        className={`h-11 w-16 items-center justify-center rounded-xl shadow-card ${
          canSend ? 'bg-accent' : 'bg-accent/40'
        }`}
      >
        <Text className="text-white font-semibold">Send</Text>
      </Pressable>
    </View>
  );
};
