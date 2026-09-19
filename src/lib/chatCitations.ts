import type { CitedItem } from '@/types';
import { itemTypeLabelKey } from './itemIcons';

export const CITATION_RE = /\[\[([A-Za-z0-9_-]+)\]\]/g;
export const ITEM_PROTOCOL = 'item://';

export function prepareCitations(text: string) {
  const indexById = new Map<string, number>();
  // Never expose an unfinished protocol token while the answer is streaming.
  const content = text.replace(/\[\[[^\]]*\]?$/, '').replace(CITATION_RE, (_match, id: string) => {
    if (!indexById.has(id)) indexById.set(id, indexById.size + 1);
    return `[${indexById.get(id)}](${ITEM_PROTOCOL}${id})`;
  });
  return { content, indexById };
}

/**
 * The domain caption under a cited item.
 *
 * Returns *source-provided* text (site name or hostname) when there is any, and
 * only falls back to a translation key — hence the `key` discriminator, which
 * tells the caller whether to render the value or translate it.
 */
export function domainLabelForRef(item: CitedItem): { text: string } | { key: string } {
  if (item.site_name?.trim()) return { text: item.site_name.trim() };
  for (const url of [item.source_url, item.raw_url]) {
    if (!url) continue;
    try { return { text: new URL(url).hostname.replace(/^www\./, '') }; } catch { /* Try the alternate URL. */ }
  }
  return { key: itemTypeLabelKey[item.type] || 'chat.message.savedSource' };
}

export function copyWithCitations(text: string, items: CitedItem[]): string {
  const { indexById } = prepareCitations(text);
  const byId = new Map(items.map(item => [item.id, item]));
  return text.replace(CITATION_RE, (_match, id: string) => {
    const item = byId.get(id);
    const url = item?.source_url || item?.raw_url;
    return `[${indexById.get(id) ?? 'Source'}]${url ? ` ${url}` : ''}`;
  });
}
