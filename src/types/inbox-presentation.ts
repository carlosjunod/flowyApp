import type { Item } from './index';

export type ReadingFilter = 'all' | 'unread' | 'read';

/** Portable display rules, mirrored byte-for-byte in the native client. */
export type CardSize = 'small' | 'medium' | 'large';
export const CARD_SIZES = ['small', 'medium', 'large'] as const;
export function isCardSize(value: unknown): value is CardSize {
  return value === 'small' || value === 'medium' || value === 'large';
}

export function savedLink(item: Pick<Item, 'source_url' | 'raw_url'>): string | null {
  for (const candidate of [item.source_url, item.raw_url]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch { /* Non-link saves still have their persisted item. */ }
  }
  return null;
}

type DisplayItem = Pick<Item, 'status' | 'exploration' | 'source_url' | 'raw_url'>;
export type RetryKind = 'processing' | 'exploration' | 'deep';
export interface ItemPresentation {
  label: string;
  busy: boolean;
  deep: boolean;
  research: boolean;
  notice?: string;
  retry?: RetryKind;
}

export function itemPresentation(item: DisplayItem): ItemPresentation {
  if (item.status === 'pending' || item.status === 'processing') {
    return { label: item.status === 'pending' ? 'Waiting to process…' : 'Processing…', busy: true, deep: false, research: false };
  }
  if (item.status === 'error') {
    return { label: savedLink(item) ? 'Link saved' : 'Saved item', busy: false, deep: false, research: false,
      notice: savedLink(item) ? 'We couldn’t finish processing. Your link is saved and you can still open it.' : 'We couldn’t finish processing this saved item. You can try again.', retry: 'processing' };
  }
  const exp = item.exploration;
  if (exp?.status === 'exploring') {
    return { label: exp.deep ? 'Deep Dive in progress…' : 'Exploring…', busy: true, deep: false, research: exp.deep === true };
  }
  // A requested run, a matched link, or an empty analysis is not a completed Deep Dive.
  const deep = exp?.status === 'enriched' && Boolean(exp.deep_analysis?.synthesis?.trim());
  const failed = exp?.status === 'error';
  const noAnalysis = exp?.deep === true && !deep && (exp.status === 'enriched' || exp.status === 'no_match');
  return { label: deep ? 'Deep Dive' : 'Processed', busy: false, deep, research: deep,
    ...(failed || noAnalysis ? {
      notice: exp?.deep ? (failed ? 'Deep Dive couldn’t finish. Your saved content is still available.' : 'No additional analysis was available. Your saved content is still available.') : 'Exploration couldn’t finish. Your saved content is still available.',
      retry: exp?.deep ? 'deep' as const : 'exploration' as const,
    } : {}),
  };
}
