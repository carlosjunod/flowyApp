import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';
import { readerAction } from '@/types/reader';

export function ExploreCTA({ item, starting = false, onPress }: { item: Item; starting?: boolean; onPress: () => void }) {
  const colors = useResolvedColors();
  const { t, tKey } = useI18n();
  // `readerAction` is the shared contract: every string it returns is a key.
  const state = readerAction(item, starting);
  const fg = state.complete || state.busy ? colors.fg : colors.onAccent;
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.disabled, busy: state.busy }}
      disabled={state.disabled} onPress={onPress} className="active:opacity-80"
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: state.complete || state.busy ? colors.surface : colors.accent, borderWidth: state.complete || state.busy ? 1 : 0, borderColor: colors.border }}>
      {state.busy ? <ActivityIndicator size="small" color={fg} /> : <Feather name={state.complete ? 'check' : state.failed ? 'rotate-cw' : 'zap'} size={17} color={fg} />}
      <Text style={{ color: fg, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{tKey(state.labelKey)}</Text>
    </Pressable>
    {!state.complete ? <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 }}>{tKey(state.hintKey)}</Text> : null}
    {/* Resuming an extraction and running research fail for different reasons,
        so each has its own sentence rather than one with a swapped noun. */}
    {state.failed ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{state.resume ? t('inbox.reader.extractionFailed') : t('inbox.reader.researchFailed')}</Text> : null}
  </View>;
}
