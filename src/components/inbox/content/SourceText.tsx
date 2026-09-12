import React from 'react';
import Markdown, { MarkdownIt } from 'react-native-markdown-display';
import { useResolvedColors } from '@/lib/theme';
import { safeSemanticUrl } from '@/types/semantic';
const parser = MarkdownIt({ html: false, linkify: true });
export function SourceText({ text }: { text: string }) {
  const colors = useResolvedColors();
  return <Markdown markdownit={parser} onLinkPress={url => Boolean(safeSemanticUrl(url))} style={{ body: { color: colors.fg, fontSize: 15, lineHeight: 22 }, link: { color: colors.accent }, code_inline: { color: colors.fg }, code_block: { color: colors.fg }, fence: { color: colors.fg } }}>{text}</Markdown>;
}
