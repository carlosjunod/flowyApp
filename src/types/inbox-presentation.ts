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

/**
 * Presentation is expressed as TRANSLATION KEYS, not sentences.
 *
 * These rules are shared verbatim with the native client, which has its own
 * dictionary. Returning `inbox.status.processing` instead of "Processing…"
 * keeps one copy of the logic while letting each platform render it in the
 * user's language. Both dictionaries must define every key below.
 */
export interface ItemPresentation {
  labelKey: string;
  busy: boolean;
  deep: boolean;
  research: boolean;
  noticeKey?: string;
  retry?: RetryKind;
}

export function itemPresentation(item: DisplayItem): ItemPresentation {
  if (item.status === 'pending' || item.status === 'processing') {
    return { labelKey: item.status === 'pending' ? 'inbox.status.waiting' : 'inbox.status.processing', busy: true, deep: false, research: false };
  }
  if (item.status === 'error') {
    return { labelKey: savedLink(item) ? 'inbox.status.linkSaved' : 'inbox.status.savedItem', busy: false, deep: false, research: false,
      noticeKey: savedLink(item) ? 'inbox.status.noticeProcessingLink' : 'inbox.status.noticeProcessingItem', retry: 'processing' };
  }
  const exp = item.exploration;
  if (exp?.status === 'exploring') {
    return { labelKey: exp.deep ? 'inbox.status.deepInProgress' : 'inbox.status.exploring', busy: true, deep: false, research: exp.deep === true };
  }
  // A requested run, a matched link, or an empty analysis is not a completed Deep Dive.
  const deep = exp?.status === 'enriched' && Boolean(exp.deep_analysis?.synthesis?.trim());
  const failed = exp?.status === 'error';
  const noAnalysis = exp?.deep === true && !deep && (exp.status === 'enriched' || exp.status === 'no_match');
  return { labelKey: deep ? 'inbox.status.deepDive' : 'inbox.status.processed', busy: false, deep, research: deep,
    ...(failed || noAnalysis ? {
      noticeKey: exp?.deep ? (failed ? 'inbox.status.noticeDeepFailed' : 'inbox.status.noticeDeepNoAnalysis') : 'inbox.status.noticeExploreFailed',
      retry: exp?.deep ? 'deep' as const : 'exploration' as const,
    } : {}),
  };
}
