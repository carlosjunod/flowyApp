import { RecipeContent } from './RecipeContent';
import { distinctOverview } from '@/types/reader';
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import type { Item } from '@/types';
import { readSemanticContent, semanticLabelParts, semanticCoverageKey, semanticEvidenceKey, safeSemanticUrl, type SemanticContentV1, type SemanticEntry, type SemanticText } from '@/types/semantic';
import { ResourceLink } from '../ResourceLink';

/**
 * Render one of the shared contract's `SemanticText` descriptors.
 *
 * A list label is assembled from two keys — "List · {count} {unit}" plus a
 * pluralised unit — because the unit agrees with the count independently of the
 * frame. `partial` appends its own suffix so the two locales can punctuate it
 * differently.
 */
function useSemanticText(): (value: SemanticText) => string {
  const { tKey } = useI18n();
  return (value: SemanticText) => {
    const unit = value.unitKey ? tKey(value.unitKey, value.vars) : undefined;
    const base = tKey(value.key, { ...value.vars, ...(unit ? { unit } : {}) });
    return value.partial ? `${base}${tKey('inbox.semantic.listPartialSuffix')}` : base;
  };
}

export function SemanticPreview({ item, compact = false }: { item: Item; compact?: boolean }) {
  const render = useSemanticText();
  const content = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  if (!content || content.layout === 'generic') return null;
  return <View className="gap-1"><Text className="text-accent text-xs font-semibold">{render(semanticLabelParts(content))}</Text>
    {/* Entry names come from the saved source and are never translated. */}
    {!compact && content.entries.length ? <Text numberOfLines={2} className="text-muted text-xs">{content.entries.slice(0, 3).map(e => e.name).join(' · ')}</Text> : null}
  </View>;
}
function ExternalLink({ url, label }: { url: string; label: string }) {
  const [error, setError] = useState(false);
  const { t } = useI18n();
  const safe = safeSemanticUrl(url);
  if (!safe) return null;
  return <View><Pressable accessibilityRole="link" accessibilityLabel={label} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => { setError(false); void Linking.openURL(safe).catch(() => setError(true)); }}>
    <Text className="text-accent text-sm underline">{label}</Text>
  </Pressable>{error ? <Text accessibilityRole="alert" className="text-muted text-xs">{t('inbox.semanticBody.openFailed')}</Text> : null}</View>;
}
function Entry({ entry, index, item, numbered }: { entry: SemanticEntry; index: number; item: Item; numbered: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { t, tKey, formatNumber } = useI18n();
  const source = safeSemanticUrl(item.source_url ?? item.raw_url);
  return <View className="py-5 border-b border-border gap-2" style={{ minWidth: 0, maxWidth: '100%' }}>
    <Text selectable className="text-fg text-base font-semibold">{numbered ? `${formatNumber(index + 1)}. ` : ''}{entry.name}</Text>
    <Text className="text-muted text-xs">{tKey(`inbox.semantic.kinds.${entry.kind}`, { count: 1 })}</Text>
    {[...entry.links].sort((a, b) => Number(b.relation === 'canonical') - Number(a.relation === 'canonical')).map(link => <ResourceLink key={link.url} url={link.url}
      title={entry.kind === 'repository' && new URL(link.url).hostname === 'github.com' ? new URL(link.url).pathname.slice(1) : entry.name}
      primary={link.relation === 'canonical'} provenance={link.origin === 'source' ? t('inbox.semanticBody.inSavedSource') : t('inbox.semanticBody.verifiedMatch')} />)}
    {entry.description ? <Text selectable className="text-muted text-sm leading-6">{entry.description}</Text> : null}
    {entry.linkable === false ? null : entry.resolution === 'ambiguous' ? <Text className="text-muted text-xs">{t('inbox.semanticBody.ambiguous')}</Text> : !entry.links.length ? <Text className="text-muted text-xs">{t('inbox.semanticBody.noLinkYet')}</Text> : null}
    {entry.searchResults?.length ? <View className="mt-3 gap-1" style={{ minWidth: 0 }}>
      <View className="flex-row items-baseline gap-2"><Text accessibilityRole="header" className="text-fg text-sm font-semibold">{t('inbox.semanticBody.relatedLinks')}</Text><Text className="text-muted text-xs">{formatNumber(entry.searchResults.length)}</Text></View>
      <Text className="text-muted text-xs leading-5 mb-1">{t('inbox.semanticBody.relatedLinksHint')}</Text>
      {entry.searchResults.map(result => <View key={result.url} className="border-b border-border">
        <ResourceLink url={result.url} title={result.title} />
      </View>)}
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setExpanded(v => !v)}>
      <Text className="text-muted text-xs underline">{expanded ? t('inbox.semanticBody.hideEvidence') : t('inbox.semanticBody.showEvidence')}</Text>
    </Pressable>
    {expanded ? entry.evidence.map((proof, i) => {
      let moment: string | undefined;
      if (source && item.type === 'youtube' && proof.seconds !== undefined) { const url = new URL(source); url.searchParams.set('t', String(proof.seconds)); moment = url.href; }
      return <View key={i} className="border-l-2 border-border pl-3 gap-2">
        {/* The quote is the saved source's own text. */}
        <Text selectable className="text-muted text-sm leading-6">{proof.quote}</Text>
        <Text className="text-muted text-xs">{tKey(semanticEvidenceKey(proof.origin))}{proof.slideIndex !== undefined ? ` · ${t('inbox.semantic.evidence.slide', { index: proof.slideIndex + 1 })}` : ''}{proof.seconds !== undefined ? ` · ${Math.floor(proof.seconds / 60)}:${String(proof.seconds % 60).padStart(2, '0')}` : ''}</Text>
        {moment ? <ExternalLink url={moment} label={t('inbox.semanticBody.openMoment')} /> : null}
      </View>;
    }) : null}
  </View>;
}
export function SemanticContent({ item, action }: { item: Item; action?: React.ReactNode }) {
  const content = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  if (!content || (content.layout === 'generic' && !semanticCoverageKey(content))) return null;
  return <SemanticBody key={`${item.id}:${content.sourceHash}`} item={item} content={content} action={action} />;
}
function SemanticBody({ item, content, action }: { item: Item; content: SemanticContentV1; action?: React.ReactNode }) {
  const [visible, setVisible] = useState(12);
  const { t } = useI18n();
  const render = useSemanticText();
  const entries = content.entries.filter(e => !content.recipe || !e.recipe);
  const coverage = semanticCoverageKey(content);
  return <View className="gap-3">
    <Text accessibilityRole="header" className="text-fg text-lg font-semibold">{render(semanticLabelParts(content))}</Text>
    {coverage ? <Text accessibilityLiveRegion="polite" className="text-muted text-sm leading-6">{render(coverage)}</Text> : null}
    {action}
    {(content.layout !== 'entity' || !content.entries[0]?.description) && distinctOverview(content.overview, item.summary) ? <Text selectable className="text-muted text-sm leading-6">{content.overview}</Text> : null}
    {content.recipe ? <RecipeContent content={content} /> : null}
    {entries.length ? <>
      <Text className="text-muted text-xs">{t('inbox.semanticBody.extracted')}{content.coverage === 'unknown' ? t('inbox.semanticBody.unverified') : ''}</Text>
      <View style={{ minWidth: 0, maxWidth: '100%' }}>{entries.slice(0, visible).map((entry, index) => <Entry key={entry.id} entry={entry} index={index} item={item} numbered={content.layout === 'list'} />)}</View>
      {visible < entries.length ? <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setVisible(n => n + 12)}><Text className="text-accent text-sm">{t('inbox.semanticBody.showMore', { count: entries.length - visible })}</Text></Pressable> : null}
    </> : null}
  </View>;
}
