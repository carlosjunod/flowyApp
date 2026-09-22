import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

type Props = { value: string; onChange: (text: string) => void; onSend: (text: string) => void; pending: boolean; preparing?: boolean; disabled: boolean; onStop: () => void };
export const ChatInput: React.FC<Props> = ({ value, onChange, onSend, pending, preparing = false, disabled, onStop }) => {
  const { t } = useI18n();
  const colors = useResolvedColors();
  const canSend = !disabled && !!value.trim();
  return (
    <View className="bg-bg px-4 pt-2 pb-3">
      <View className="flex-row items-end gap-2 rounded-[26px] border border-border bg-card p-1.5">
        <TextInput accessibilityLabel={t('chat.composer.label')} value={value} onChangeText={onChange}
          placeholder={t('chat.composer.placeholder')} placeholderTextColor={colors.muted} multiline
          style={{ fontSize: 16, lineHeight: 24 }}
          className="flex-1 min-h-[44px] max-h-32 rounded-xl px-3 py-2.5 text-fg" />
        <Pressable onPress={() => pending ? onStop() : onSend(value)} disabled={!pending && !canSend}
          accessibilityRole="button" accessibilityLabel={preparing ? t('chat.composer.cancelConnecting') : pending ? t('chat.composer.stop') : t('chat.composer.send')}
          accessibilityState={{ disabled: !pending && !canSend }}
          style={({ pressed }) => ({ backgroundColor: pending || canSend ? colors.chatSend : colors.surface, opacity: pressed ? 0.8 : 1 })}
          className={`h-11 items-center justify-center rounded-full ${pending && !preparing ? 'px-4' : 'w-11'}`}>
          {preparing ? <ActivityIndicator color={pending || canSend ? colors.onChatSend : colors.muted} size="small" /> : pending ? <View className="flex-row items-center gap-2"><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: pending || canSend ? colors.onChatSend : colors.muted }} /><Text style={{ color: pending || canSend ? colors.onChatSend : colors.muted }} className="font-medium">{t('chat.composer.stopShort')}</Text></View> : <Feather name="arrow-up" size={20} color={pending || canSend ? colors.onChatSend : colors.muted} />}
        </Pressable>
      </View>
      {preparing ? <Text accessibilityLiveRegion="polite" className="text-xs text-muted pt-2">{t('chat.composer.connecting')}</Text> : null}
      {disabled && !pending ? <Text className="text-xs text-muted pt-2">{t('chat.composer.blocked')}</Text> : null}
    </View>
  );
};
