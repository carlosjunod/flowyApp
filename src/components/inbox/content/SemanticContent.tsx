import { distinctOverview } from '@/types/reader';
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { Item } from '@/types';
import { readSemanticContent, semanticLabel, semanticCoverageMessage, semanticEvidenceLabel, safeSemanticUrl, type SemanticContentV1, type SemanticEntry } from '@/types/semantic';
import { ResourceLink } from '../ResourceLink';

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
function Entry({ entry, index, item, numbered }: { entry: SemanticEntry; index: number; item: Item; numbered: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const source = safeSemanticUrl(item.source_url ?? item.raw_url);
  return <View className="py-5 border-b border-border gap-2" style={{ minWidth: 0, maxWidth: '100%' }}>
    <Text selectable className="text-fg text-base font-semibold">{numbered ? `${index + 1}. ` : ''}{entry.name}</Text>
    <Text className="text-muted text-xs capitalize">{entry.kind}</Text>
    {[...entry.links].sort((a, b) => Number(b.relation === 'canonical') - Number(a.relation === 'canonical')).map(link => <ResourceLink key={link.url} url={link.url}
      title={entry.kind === 'repository' && new URL(link.url).hostname === 'github.com' ? new URL(link.url).pathname.slice(1) : entry.name}
      primary={link.relation === 'canonical'} provenance={link.origin === 'source' ? 'In saved source' : 'Verified match'} />)}
    {entry.description ? <Text selectable className="text-muted text-sm leading-6">{entry.description}</Text> : null}
    {entry.linkable === false ? null : entry.resolution === 'ambiguous' ? <Text className="text-muted text-xs">The official destination could not be confirmed.</Text> : !entry.links.length ? <Text className="text-muted text-xs">No verified link yet.</Text> : null}
    {entry.searchResults?.length ? <View className="mt-3 gap-1" style={{ minWidth: 0 }}>
      <View className="flex-row items-baseline gap-2"><Text accessibilityRole="header" className="text-fg text-sm font-semibold">Related links</Text><Text className="text-muted text-xs">{entry.searchResults.length}</Text></View>
      <Text className="text-muted text-xs leading-5 mb-1">From web search. These matches are not verified.</Text>
      {entry.searchResults.map(result => <View key={result.url} className="border-b border-border">
        <ResourceLink url={result.url} title={result.title} />
      </View>)}
    </View> : null}
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
export function SemanticContent({ item, action }: { item: Item; action?: React.ReactNode }) {
  const content = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  if (!content || (content.layout === 'generic' && !semanticCoverageMessage(content))) return null;
  return <SemanticBody key={`${item.id}:${content.sourceHash}`} item={item} content={content} action={action} />;
}
function SemanticBody({ item, content, action }: { item: Item; content: SemanticContentV1; action?: React.ReactNode }) {
  const [visible, setVisible] = useState(12);
  return <View className="gap-3">
    <Text accessibilityRole="header" className="text-fg text-lg font-semibold">{semanticLabel(content)}</Text>
    {semanticCoverageMessage(content) ? <Text accessibilityLiveRegion="polite" className="text-muted text-sm leading-6">{semanticCoverageMessage(content)}</Text> : null}
    {action}
    {(content.layout !== 'entity' || !content.entries[0]?.description) && distinctOverview(content.overview, item.summary) ? <Text selectable className="text-muted text-sm leading-6">{content.overview}</Text> : null}
    {content.entries.length ? <>
      <Text className="text-muted text-xs">Extracted from the saved source.{content.coverage === 'unknown' ? ' Source completeness has not been verified.' : ''}</Text>
      <View style={{ minWidth: 0, maxWidth: '100%' }}>{content.entries.slice(0, visible).map((entry, index) => <Entry key={entry.id} entry={entry} index={index} item={item} numbered={content.layout === 'list'} />)}</View>
      {visible < content.entries.length ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setVisible(n => n + 12)}><Text className="text-accent text-sm">Show more ({content.entries.length - visible} remaining)</Text></Pressable> : null}
    </> : null}
  </View>;
}
