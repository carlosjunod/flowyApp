import type { Item, ItemType } from '@/types';

import { ENV } from './env';

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;

export const extractYoutubeId = (url: string): string | null => {
  const match = url.match(YOUTUBE_ID_RE);
  return match?.[1] ?? null;
};

export const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

export const typeGlyph: Record<ItemType, string> = {
  url: '🔗',
  screenshot: '🖼️',
  youtube: '▶',
  video: '🎬',
  receipt: '🧾',
  pdf: '📄',
  audio: '🎧',
};

export type Thumb =
  | { kind: 'image'; uri: string }
  | { kind: 'glyph'; glyph: string };

export const thumbnailFor = (item: Item): Thumb => {
  if (item.r2_key) {
    return { kind: 'image', uri: `${ENV.R2_PUBLIC_URL}/${item.r2_key}` };
  }
  const url = item.raw_url ?? item.source_url;
  if (item.type === 'youtube' && url) {
    const id = extractYoutubeId(url);
    if (id) return { kind: 'image', uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
  }
  if (url) {
    const host = hostOf(url);
    if (host) {
      return {
        kind: 'image',
        uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      };
    }
  }
  return { kind: 'glyph', glyph: typeGlyph[item.type] };
};
