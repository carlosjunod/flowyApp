import React, { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import Markdown, { MarkdownIt, type ASTNode, type RenderRules } from 'react-native-markdown-display';
import { useI18n } from '@/lib/i18n';
import { useResolvedColors } from '@/lib/theme';
import { safeSemanticUrl } from '@/types/semantic';
const parser = MarkdownIt({ html: false, linkify: true });
const tableColumns = (node: ASTNode): number => node.type === 'tr' ? node.children.length : Math.max(1, ...node.children.map(tableColumns));
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Saved READMEs and articles often embed raw HTML (`<table>`, `<a><img></a>`,
// `<br>`). The parser runs with `html: false`, so those tags would otherwise
// print as literal text. Outside code spans, links keep their label and URL,
// images and layout tags are dropped, and line-level tags become line breaks.
const HTML_TAG = /<\/?(?:a|abbr|b|br|center|code|dd|del|details|div|dl|dt|em|figcaption|figure|font|h[1-6]|hr|i|img|kbd|li|ol|p|picture|pre|s|small|source|span|strong|sub|summary|sup|table|tbody|td|tfoot|th|thead|tr|u|ul|video)\b[^>]*>/gi;
function stripHtmlSegment(segment: string): string {
  return segment
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(HTML_TAG, '').replace(/\s+/g, ' ').trim();
      return label && safeSemanticUrl(href) ? `[${label}](${href})` : label;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table|details|summary|figure)>/gi, '\n')
    .replace(HTML_TAG, '')
    .replace(/\n{3,}/g, '\n\n');
}
export function stripHtml(text: string): string {
  if (!/<[a-z/][^>]*>/i.test(text)) return text;
  // Fenced blocks and inline code are content that may legitimately show HTML.
  return text.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]+`)/g)
    .map((part, index) => index % 2 === 1 ? part : stripHtmlSegment(part)).join('');
}

/** Renders saved source text. The text itself is content and is never translated —
 *  only the accessibility labels around the code/table scrollers are. */
export function SourceText({ text }: { text: string }) {
  const { t } = useI18n();
  const colors = useResolvedColors();
  const [width, setWidth] = useState(0);
  const code: RenderRules['fence'] = node => <ScrollView key={node.key} horizontal nestedScrollEnabled directionalLockEnabled
    accessibilityLabel={t('inbox.content.codeBlock')} showsHorizontalScrollIndicator
    style={{ maxWidth: '100%', flexGrow: 0, marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    contentContainerStyle={{ padding: 12 }}>
    <Text selectable style={{ color: colors.fg, fontSize: 13, lineHeight: 20, fontFamily: mono }}>{node.content.replace(/\n$/, '')}</Text>
  </ScrollView>;
  const rules: RenderRules = {
    code_block: code, fence: code,
    // The table is at least as wide as the reader so header fills and row
    // borders span the whole frame; wider tables scroll horizontally.
    table: (node, children) => <ScrollView key={node.key} horizontal nestedScrollEnabled directionalLockEnabled
      accessibilityLabel={t('inbox.content.table')} showsHorizontalScrollIndicator style={{ maxWidth: '100%', flexGrow: 0, marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: Math.max(width - 2, tableColumns(node) * 160) }}>{children}</View>
    </ScrollView>,
  };
  const heading = (fontSize: number, lineHeight: number) => ({
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, color: colors.fg, fontSize, lineHeight,
    fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 6,
  });
  return <View style={{ minWidth: 0, maxWidth: '100%' }} onLayout={e => setWidth(Math.round(e.nativeEvent.layout.width))}>
    <Markdown markdownit={parser} rules={rules} onLinkPress={url => Boolean(safeSemanticUrl(url))} style={{
      body: { color: colors.fg, fontSize: 15, lineHeight: 22, flexShrink: 1 }, link: { color: colors.accent },
      heading1: heading(22, 30), heading2: heading(20, 28), heading3: heading(18, 26),
      heading4: heading(16, 24), heading5: heading(15, 22), heading6: heading(15, 22),
      hr: { backgroundColor: colors.border, height: 1, marginVertical: 16 },
      blockquote: { backgroundColor: colors.surface, borderColor: colors.accent, borderLeftWidth: 3, borderRadius: 4,
        marginLeft: 0, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 4 },
      code_inline: { color: colors.fg, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 0, padding: 0, fontFamily: mono, fontSize: 13 },
      table: { borderWidth: 0 },
      tr: { borderColor: colors.border }, th: { padding: 12, backgroundColor: colors.surface }, td: { padding: 12 },
    }}>{stripHtml(text)}</Markdown>
  </View>;
}
