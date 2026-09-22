import React from 'react';
import { Text, View } from 'react-native';
import { CollapsibleSection } from './CollapsibleSection';
import { SourceText } from './content/SourceText';
import { readerResearch } from '@/types/reader';
import { safeSemanticUrl } from '@/types/semantic';
import { useI18n } from '@/lib/i18n';
import { ResourceLink } from './ResourceLink';
import type { ItemExploration } from '@/types';

/**
 * Research output mixes two kinds of string in one list: model-written text
 * (`text`, `detail`) that is rendered as generated, and generated captions
 * (`textKey`, `detailKey`) that are interface copy. `readerResearch` keeps them
 * in separate fields precisely so this component never has to guess.
 */
export function EnrichedSections({ exploration }: { exploration: ItemExploration }) {
  const { tKey } = useI18n();
  return <View style={{ minWidth: 0, maxWidth: '100%' }}>{readerResearch(exploration).map(section => <CollapsibleSection key={section.labelKey} label={tKey(section.labelKey)} defaultOpen={false} badge={section.links?.length}>
    {section.textKey ? <Text className="text-muted text-sm leading-6 pb-2">{tKey(section.textKey, section.textVars)}</Text> : null}
    {section.text ? <SourceText text={section.text} /> : null}
    {section.links ? <View style={{ gap: 12, minWidth: 0 }}>{section.links.map((link, index) => <View key={index} className="border-b border-border pb-3" style={{ minWidth: 0, maxWidth: '100%' }}>
      {safeSemanticUrl(link.url) ? <ResourceLink url={link.url!} title={link.title} provenance={link.detailKey ? tKey(link.detailKey, link.detailVars) : undefined} /> : <Text className="text-fg font-semibold text-sm">{link.title}</Text>}
      {link.detail ? <SourceText text={link.detail} /> : null}
    </View>)}</View> : null}
  </CollapsibleSection>)}</View>;
}
