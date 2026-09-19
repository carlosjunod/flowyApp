import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { useItemActions } from '@/hooks/useItemActions';
import { itemPresentation, savedLink } from '@/types/inbox-presentation';
import type { Item } from '@/types';
import { ReadingIndicator } from './ReadingIndicator';

export function ItemStatus({ item, selectionMode = false }: { item: Item; selectionMode?: boolean }) {
  const colors = useResolvedColors();
  const { t, tKey } = useI18n();
  const reducedMotion = useReducedMotion();
  // `itemPresentation` returns translation KEYS — see types/inbox-presentation.
  const state = itemPresentation(item);
  const actions = useItemActions();
  const lock = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failureKey, setFailureKey] = useState('');
  const url = savedLink(item);
  const tint = state.research ? colors.accent : colors.muted;
  async function retry() {
    if (lock.current || !state.retry) return;
    lock.current = true; setStarting(true); setFailureKey('');
    try {
      const failed = state.retry === 'processing' ? !(await actions.reloadItem(item.id)).ok : await (async () => {
        const result = await actions.exploreMany([item.id], { deep: state.retry === 'deep' });
        return !result.ok || result.data.failed.length > 0;
      })();
      if (failed) setFailureKey('inbox.status.retryStartFailed');
    } catch { setFailureKey('inbox.status.retryConfirmFailed'); }
    finally { lock.current = false; setStarting(false); }
  }
  return <View style={{ paddingTop: 8, gap: 6 }}>
    {state.noticeKey ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{tKey(state.noticeKey)}</Text> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 5, minHeight: 24, ...(state.deep ? { backgroundColor: colors.inboxDeep, paddingHorizontal: 7, borderRadius: 6 } : {}) }}>
        {state.busy || starting ? reducedMotion ? <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: tint, borderRightColor: 'transparent', borderRadius: 7 }} /> : <ActivityIndicator size="small" color={tint} /> : state.deep ? <Feather name="compass" size={13} color={tint} /> : null}
        <Text style={{ color: tint, fontSize: 12, flexShrink: 1, fontFamily: state.deep ? 'Inter_500Medium' : 'Inter_400Regular' }}>{starting ? t('inbox.status.startingRetry') : tKey(state.labelKey)}</Text>
      </View>
      <ReadingIndicator item={item} showLabel />
    </View>
    {state.retry && !selectionMode ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {url ? <Pressable accessibilityRole="link" accessibilityLabel={t('inbox.status.openSavedLink')} onPress={event => { event.stopPropagation(); void Linking.openURL(url).catch(() => setFailureKey('inbox.status.openLinkFailed')); }} style={{ minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ fontSize: 12, color: colors.fg }}>{t('inbox.status.openLink')}</Text><Feather name="arrow-up-right" size={13} color={colors.fg} /></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={starting || actions.pending.has(item.id)} onPress={event => { event.stopPropagation(); void retry(); }} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', opacity: starting ? 0.6 : 1 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{starting ? t('inbox.status.retrying') : state.retry === 'processing' ? t('inbox.status.retryProcessing') : state.retry === 'deep' ? t('inbox.status.retryDeep') : t('inbox.status.retryExploration')}</Text></Pressable>
    </View> : null}
    {failureKey ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12 }}>{tKey(failureKey)}</Text> : null}
  </View>;
}
