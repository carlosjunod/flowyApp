import React from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CollapsibleSection } from './CollapsibleSection';
import { SourceText } from './content/SourceText';
import { readerResearch } from '@/types/reader';
import { safeSemanticUrl } from '@/types/semantic';
import { useResolvedColors } from '@/lib/theme';
import type { ItemExploration } from '@/types';

export function EnrichedSections({ exploration }: { exploration: ItemExploration }) {
  const colors = useResolvedColors();
  return <View>{readerResearch(exploration).map(section => <CollapsibleSection key={section.label} label={section.label} defaultOpen={false} badge={section.links?.length}>
    {section.text ? <SourceText text={section.text} /> : null}
    {section.links ? <View style={{ gap: 12 }}>{section.links.map((link, index) => <View key={index} className="rounded-xl border border-border p-3">
      {safeSemanticUrl(link.url) ? <Pressable accessibilityRole="link" onPress={() => Linking.openURL(safeSemanticUrl(link.url)!).catch(() => Alert.alert('Could not open link', 'Please try again.'))} className="active:opacity-80" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, fontFamily: 'Inter_600SemiBold', color: colors.accent, fontSize: 14 }}>{link.title}</Text><Feather name="arrow-up-right" size={16} color={colors.accent} /></Pressable> : <Text className="text-fg font-semibold text-sm">{link.title}</Text>}
      {link.url && safeSemanticUrl(link.url) ? <Text className="text-muted text-xs mb-2">{new URL(link.url).hostname.replace(/^www\./, '')}</Text> : null}
      {link.detail ? <SourceText text={link.detail} /> : null}
    </View>)}</View> : null}
  </CollapsibleSection>)}</View>;
}
