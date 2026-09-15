import React from 'react';
import { Text, View } from 'react-native';
import { CollapsibleSection } from './CollapsibleSection';
import { SourceText } from './content/SourceText';
import { readerResearch } from '@/types/reader';
import { safeSemanticUrl } from '@/types/semantic';
import { ResourceLink } from './ResourceLink';
import type { ItemExploration } from '@/types';

export function EnrichedSections({ exploration }: { exploration: ItemExploration }) {
  return <View style={{ minWidth: 0, maxWidth: '100%' }}>{readerResearch(exploration).map(section => <CollapsibleSection key={section.label} label={section.label} defaultOpen={false} badge={section.links?.length}>
    {section.text ? <SourceText text={section.text} /> : null}
    {section.links ? <View style={{ gap: 12, minWidth: 0 }}>{section.links.map((link, index) => <View key={index} className="border-b border-border pb-3" style={{ minWidth: 0, maxWidth: '100%' }}>
      {safeSemanticUrl(link.url) ? <ResourceLink url={link.url!} title={link.title} /> : <Text className="text-fg font-semibold text-sm">{link.title}</Text>}
      {link.detail ? <SourceText text={link.detail} /> : null}
    </View>)}</View> : null}
  </CollapsibleSection>)}</View>;
}
