import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useResolvedColors } from '@/lib/theme';

type Props = { value: string; onChange: (text: string) => void; onSend: (text: string) => void; pending: boolean; disabled: boolean; onStop: () => void };
export const ChatInput: React.FC<Props> = ({ value, onChange, onSend, pending, disabled, onStop }) => {
  const colors = useResolvedColors();
  const canSend = !disabled && !!value.trim();
  return (
    <View className="bg-bg px-4 pt-2 pb-3">
      <View className="flex-row items-end gap-2 rounded-[26px] border border-border bg-card p-1.5">
        <TextInput accessibilityLabel="Message" value={value} onChangeText={onChange}
          placeholder="Ask about your saved content…" placeholderTextColor={colors.muted} multiline
          style={{ fontSize: 16, lineHeight: 24 }}
          className="flex-1 min-h-[44px] max-h-32 rounded-xl px-3 py-2.5 text-fg" />
        <Pressable onPress={() => pending ? onStop() : onSend(value)} disabled={!pending && !canSend}
          accessibilityRole="button" accessibilityLabel={pending ? 'Stop response' : 'Send message'}
          accessibilityState={{ disabled: !pending && !canSend }}
          style={({ pressed }) => ({ backgroundColor: pending || canSend ? colors.chatSend : colors.surface, opacity: pressed ? 0.8 : 1 })}
          className="h-11 w-11 items-center justify-center rounded-full">
          <Feather name={pending ? 'square' : 'arrow-up'} size={20} color={pending || canSend ? colors.onChatSend : colors.muted} />
        </Pressable>
      </View>
      {disabled && !pending ? <Text className="text-xs text-muted pt-2">Finish or stop the other response before sending.</Text> : null}
    </View>
  );
};
