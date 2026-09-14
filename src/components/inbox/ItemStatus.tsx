import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useResolvedColors } from '@/lib/theme';
import { useItemActions } from '@/hooks/useItemActions';
import { itemPresentation, savedLink } from '@/types/inbox-presentation';
import type { Item } from '@/types';
import { ReadingIndicator } from './ReadingIndicator';

export function ItemStatus({ item, selectionMode = false }: { item: Item; selectionMode?: boolean }) {
  const colors = useResolvedColors();
  const reducedMotion = useReducedMotion();
  const state = itemPresentation(item);
  const actions = useItemActions();
  const lock = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState('');
  const url = savedLink(item);
  const tint = state.research ? colors.accent : colors.muted;
  async function retry() {
    if (lock.current || !state.retry) return;
    lock.current = true; setStarting(true); setFailure('');
    try {
      const failed = state.retry === 'processing' ? !(await actions.reloadItem(item.id)).ok : await (async () => {
        const result = await actions.exploreMany([item.id], { deep: state.retry === 'deep' });
        return !result.ok || result.data.failed.length > 0;
      })();
      if (failed) setFailure('Couldn’t start the retry. Your save is still available.');
    } catch { setFailure('Couldn’t confirm the retry. Refresh to check its status.'); }
    finally { lock.current = false; setStarting(false); }
  }
  return <View style={{ paddingTop: 8, gap: 6 }}>
    {state.notice ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{state.notice}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 5, minHeight: 24, ...(state.deep ? { backgroundColor: colors.inboxDeep, paddingHorizontal: 7, borderRadius: 6 } : {}) }}>
        {state.busy || starting ? reducedMotion ? <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: tint, borderRightColor: 'transparent', borderRadius: 7 }} /> : <ActivityIndicator size="small" color={tint} /> : state.deep ? <Feather name="compass" size={13} color={tint} /> : null}
        <Text style={{ color: tint, fontSize: 12, flexShrink: 1, fontFamily: state.deep ? 'Inter_500Medium' : 'Inter_400Regular' }}>{starting ? 'Starting retry…' : state.label}</Text>
      </View>
      <ReadingIndicator item={item} showLabel />
    </View>
    {state.retry && !selectionMode ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {url ? <Pressable accessibilityRole="link" accessibilityLabel="Open saved link" onPress={event => { event.stopPropagation(); void Linking.openURL(url).catch(() => setFailure('Couldn’t open the link. It remains saved.')); }} style={{ minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 12, color: colors.fg }}>Open link</Text><Feather name="arrow-up-right" size={13} color={colors.fg} /></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={starting || actions.pending.has(item.id)} onPress={event => { event.stopPropagation(); void retry(); }} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', opacity: starting ? 0.6 : 1 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{starting ? 'Retrying…' : state.retry === 'processing' ? 'Retry processing' : state.retry === 'deep' ? 'Retry Deep Dive' : 'Retry exploration'}</Text></Pressable>
    </View> : null}
    {failure ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12 }}>{failure}</Text> : null}
  </View>;
}
