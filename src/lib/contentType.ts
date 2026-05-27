import type { Item } from '@/types';

/**
 * Logical content classification used by the detail screen to pick a renderer.
 * - `carousel` — Instagram post with 2+ media slides
 * - `youtube`  — YouTube videos (regular, shorts)
 * - `reel`     — Instagram Reel (single video)
 * - `receipt`  — Photographed receipt with extracted line items
 * - `generic`  — anything else (article, screenshot, tweet, TikTok, …)
 *
 * Mirrors apps/web/lib/contentType.ts so detail behavior stays in lockstep.
 */
export type ContentType = 'carousel' | 'youtube' | 'reel' | 'receipt' | 'generic';

// Match both legacy `instagram.com/reel/<code>/` and the newer
// `instagram.com/<username>/reel/<code>/` share-sheet format.
const REEL_URL_RE = /instagram\.com\/(?:[\w.-]+\/)?(?:reel|reels)\//i;

export function getContentType(item: Item): ContentType {
  if (item.type === 'receipt') return 'receipt';
  if (item.type === 'youtube') return 'youtube';

  if (item.type === 'instagram') {
    if (Array.isArray(item.media) && item.media.length > 1) return 'carousel';
    const src = item.source_url ?? item.raw_url ?? '';
    if (REEL_URL_RE.test(src)) return 'reel';
  }

  return 'generic';
}
