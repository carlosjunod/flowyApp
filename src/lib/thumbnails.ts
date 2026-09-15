import { isDocumentItem } from '@/types/files';
import { savedMediaKind } from '@/types/reader';
import type { Item } from '@/types';

import { ENV } from './env';
import { itemTypeIcon, type ItemIconName } from './itemIcons';

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

export type Thumb =
  | { kind: 'image'; uri: string }
  | { kind: 'icon'; icon: ItemIconName };

export const thumbnailFor = (item: Item): Thumb => {
  if(isDocumentItem(item))return {kind:'icon',icon:itemTypeIcon[item.type]};
  if (item.r2_key && savedMediaKind(item.r2_key) !== 'video') {
    return { kind: 'image', uri: `${ENV.R2_PUBLIC_URL}/${item.r2_key}` };
  }
  const poster = item.media?.find(slide => savedMediaKind(slide.r2_key) === 'image');
  if (poster) return { kind: 'image', uri: `${ENV.R2_PUBLIC_URL}/${poster.r2_key}` };
  if (item.og_image) return { kind: 'image', uri: item.og_image };
  const url = item.raw_url ?? item.source_url;
  if (item.type === 'youtube' && url) {
    const id = extractYoutubeId(url);
    if (id) return { kind: 'image', uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
  }
  return { kind: 'icon', icon: itemTypeIcon[item.type] };
};
