import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { safeSemanticUrl } from '@/types/semantic';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';

export function ResourceLink({ url, title, provenance, primary = false }: {
  url: string; title: string; provenance?: string; primary?: boolean;
}) {
  const [error, setError] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { t } = useI18n();
  const colors = useResolvedColors();
  const safe = safeSemanticUrl(url);
  if (!safe) return null;
  const domain = new URL(safe).hostname.replace(/^www\./, '');
  return <View style={{ minWidth: 0, maxWidth: '100%' }}>
    <Pressable accessibilityRole="link" accessibilityLabel={`${title}, ${domain}${provenance ? `, ${provenance}` : ''}`}
      accessibilityHint={t('common.a11y.externalLink')} onPress={() => { setError(false); void Linking.openURL(safe).catch(() => setError(true)); }}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
      {/* Layout sits on a plain View: a Pressable style callback is not reliably
          applied on native under NativeWind, which stacked this row vertically. */}
      <View style={{ minHeight: 64, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 8, backgroundColor: pressed ? colors.accent + '1F' : primary ? colors.accent + '14' : 'transparent' }}>
      {primary ? <Feather name="link" size={18} color={colors.accent} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 }}>{domain}</Text>
          {provenance ? <Text style={{ color: primary ? colors.accent : colors.muted, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' }}>{provenance}</Text> : null}
        </View>
        <Text numberOfLines={2} style={{ color: primary ? colors.accent : colors.fg, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>{title}</Text>
      </View>
      <Feather name="arrow-up-right" size={16} color={colors.muted} />
      </View>
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 12 }}>{t('inbox.semanticBody.openFailed')}</Text> : null}
  </View>;
}
