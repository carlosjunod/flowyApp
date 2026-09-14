import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResolvedColors } from '@/lib/theme';
import type { Item } from '@/types';
import { readerAction } from '@/types/reader';

export function ExploreCTA({ item, starting = false, onPress }: { item: Item; starting?: boolean; onPress: () => void }) {
  const colors = useResolvedColors();
  const state = readerAction(item, starting);
  const fg = state.complete || state.busy ? colors.fg : colors.onAccent;
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.disabled, busy: state.busy }}
      disabled={state.disabled} onPress={onPress} className="active:opacity-80"
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: state.complete || state.busy ? colors.surface : colors.accent, borderWidth: state.complete || state.busy ? 1 : 0, borderColor: colors.border }}>
      {state.busy ? <ActivityIndicator size="small" color={fg} /> : <Feather name={state.complete ? 'check' : state.failed ? 'rotate-cw' : 'zap'} size={17} color={fg} />}
      <Text style={{ color: fg, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, flexShrink: 1 }}>{state.label}</Text>
    </Pressable>
    {!state.complete ? <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 }}>{state.hint}</Text> : null}
    {state.failed ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{state.resume ? 'Extraction' : 'Research'} didn’t finish. Your saved content is safe. Try again.</Text> : null}
  </View>;
}
