import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

type Props = {
  onSend: (text: string) => void;
  disabled: boolean;
};

export const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-bg px-4 py-3">
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask about your inbox…"
        placeholderTextColor="#94a3b8"
        multiline
        className="flex-1 min-h-[44px] max-h-32 rounded-xl border border-border bg-card px-3 py-2 text-fg"
      />
      <Pressable
        onPress={submit}
        disabled={disabled || !value.trim()}
        className={`h-11 w-16 items-center justify-center rounded-xl ${
          disabled || !value.trim() ? 'bg-accent/40' : 'bg-accent'
        }`}
      >
        <Text className="text-white font-semibold">Send</Text>
      </Pressable>
    </View>
  );
};
