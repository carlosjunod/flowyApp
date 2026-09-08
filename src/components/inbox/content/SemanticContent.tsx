import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { Item } from '@/types';
import { readSemanticContent, semanticLabel, semanticCoverageMessage, semanticEvidenceLabel, safeSemanticUrl, type SemanticContentV1, type SemanticEntry } from '@/types/semantic';

export function SemanticPreview({ item, compact = false }: { item: Item; compact?: boolean }) {
  const content = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  if (!content || content.layout === 'generic') return null;
  return <View className="gap-1"><Text className="text-accent text-xs font-semibold">{semanticLabel(content)}</Text>
    {!compact && content.entries.length ? <Text numberOfLines={2} className="text-muted text-xs">{content.entries.slice(0, 3).map(e => e.name).join(' · ')}</Text> : null}
  </View>;
}
function ExternalLink({ url, label }: { url: string; label: string }) {
  const [error, setError] = useState(false);
  const safe = safeSemanticUrl(url);
  if (!safe) return null;
  return <View><Pressable accessibilityRole="link" accessibilityLabel={label} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { setError(false); void Linking.openURL(safe).catch(() => setError(true)); }}>
    <Text className="text-accent text-sm underline">{label}</Text>
  </Pressable>{error ? <Text accessibilityRole="alert" className="text-muted text-xs">Could not open this link. Try again.</Text> : null}</View>;
}
function Entry({ entry, index, item }: { entry: SemanticEntry; index: number; item: Item }) {
  const [expanded, setExpanded] = useState(false);
  const source = safeSemanticUrl(item.source_url ?? item.raw_url);
  return <View className="p-4 border-b border-border gap-2">
    <Text selectable className="text-fg text-base font-semibold">{index + 1}. {entry.name}</Text>
    <Text className="text-muted text-xs capitalize">{entry.kind}</Text>
    {entry.description ? <Text selectable className="text-muted text-sm leading-6">{entry.description}</Text> : null}
    {entry.links.map(link => <ExternalLink key={link.url} url={link.url} label={`${new URL(link.url).hostname.replace(/^www\./, '')} · ${link.origin === 'source' ? 'in source' : 'verified match'}`} />)}
    {entry.resolution === 'ambiguous' ? <Text className="text-muted text-xs">Exact match needs more context.</Text> : !entry.links.length ? <Text className="text-muted text-xs">No verified link yet.</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setExpanded(v => !v)}>
      <Text className="text-muted text-xs underline">{expanded ? 'Hide source evidence' : 'Show source evidence'}</Text>
    </Pressable>
    {expanded ? entry.evidence.map((proof, i) => {
      let moment: string | undefined;
      if (source && item.type === 'youtube' && proof.seconds !== undefined) { const url = new URL(source); url.searchParams.set('t', String(proof.seconds)); moment = url.href; }
      return <View key={i} className="border-l-2 border-border pl-3 gap-2">
        <Text selectable className="text-muted text-sm leading-6">{proof.quote}</Text>
        <Text className="text-muted text-xs">{semanticEvidenceLabel(proof.origin)}{proof.slideIndex !== undefined ? ` · Slide ${proof.slideIndex + 1}` : ''}{proof.seconds !== undefined ? ` · ${Math.floor(proof.seconds / 60)}:${String(proof.seconds % 60).padStart(2, '0')}` : ''}</Text>
        {moment ? <ExternalLink url={moment} label="Open this moment" /> : null}
      </View>;
    }) : null}
  </View>;
}
export function SemanticContent({ item }: { item: Item }) {
  const content = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  if (!content || (content.layout === 'generic' && !semanticCoverageMessage(content))) return null;
  return <SemanticBody key={`${item.id}:${content.sourceHash}`} item={item} content={content} />;
}
function SemanticBody({ item, content }: { item: Item; content: SemanticContentV1 }) {
  const [visible, setVisible] = useState(12);
  return <View className="mb-6 gap-3">
    <Text accessibilityRole="header" className="text-fg text-lg font-semibold">{semanticLabel(content)}</Text>
    {semanticCoverageMessage(content) ? <Text accessibilityLiveRegion="polite" className="text-muted text-xs">{semanticCoverageMessage(content)}</Text> : null}
    {content.overview ? <Text selectable className="text-muted text-sm leading-6">{content.overview}</Text> : null}
    {content.entries.length ? <>
      <Text className="text-muted text-xs">Extracted from the saved source.{content.coverage === 'unknown' ? ' Source completeness has not been verified.' : ''}</Text>
      <View className="rounded-xl border border-border bg-card overflow-hidden">{content.entries.slice(0, visible).map((entry, index) => <Entry key={entry.id} entry={entry} index={index} item={item} />)}</View>
      {visible < content.entries.length ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setVisible(n => n + 12)}><Text className="text-accent text-sm">Show more ({content.entries.length - visible} remaining)</Text></Pressable> : null}
    </> : null}
    <Text accessibilityRole="header" className="text-muted text-xs uppercase font-semibold mt-3">Original content</Text>
  </View>;
}
