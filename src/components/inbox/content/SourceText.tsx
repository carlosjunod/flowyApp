import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import Markdown, { MarkdownIt, type ASTNode, type RenderRules } from 'react-native-markdown-display';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { safeSemanticUrl } from '@/types/semantic';
const parser = MarkdownIt({ html: false, linkify: true });
const tableColumns = (node: ASTNode): number => node.type === 'tr' ? node.children.length : Math.max(1, ...node.children.map(tableColumns));

/** Renders saved source text. The text itself is content and is never translated —
 *  only the accessibility labels around the code/table scrollers are. */
export function SourceText({ text }: { text: string }) {
  const { t } = useI18n();
  const colors = useResolvedColors();
  const code: RenderRules['fence'] = node => <ScrollView key={node.key} horizontal nestedScrollEnabled directionalLockEnabled
    accessibilityLabel={t('inbox.content.codeBlock')} showsHorizontalScrollIndicator
    style={{ maxWidth: '100%', flexGrow: 0, marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    contentContainerStyle={{ padding: 12 }}>
    <Text selectable style={{ color: colors.fg, fontSize: 13, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{node.content}</Text>
  </ScrollView>;
  const rules: RenderRules = {
    code_block: code, fence: code,
    table: (node, children) => <ScrollView key={node.key} horizontal nestedScrollEnabled directionalLockEnabled
      accessibilityLabel={t('inbox.content.table')} showsHorizontalScrollIndicator style={{ maxWidth: '100%', flexGrow: 0, marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: Math.max(320, tableColumns(node) * 160) }}>{children}</View>
    </ScrollView>,
  };
  return <View style={{ minWidth: 0, maxWidth: '100%' }}><Markdown markdownit={parser} rules={rules} onLinkPress={url => Boolean(safeSemanticUrl(url))} style={{
    body: { color: colors.fg, fontSize: 15, lineHeight: 22, flexShrink: 1 }, link: { color: colors.accent },
    code_inline: { color: colors.fg, backgroundColor: colors.surface },
    tr: { borderColor: colors.border }, th: { padding: 12, backgroundColor: colors.surface }, td: { padding: 12 },
  }}>{text}</Markdown></View>;
}
