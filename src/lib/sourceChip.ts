import type { ContentType } from './contentType';
import type { Item, ItemType } from '@/types';

export type SourceChip = {
  icon: string;
  label: string;
  variant?: 'default' | 'dark' | 'green';
};

/**
 * Map an item to the small chip shown in the meta header (icon + human label).
 *
 * Content-type-aware variants take precedence over raw item.type — an Instagram
 * post that's actually a carousel shows "Instagram Carousel · N slides", not
 * just "Instagram Post".
 *
 * Mirrors apps/web/components/inbox/ItemDrawer.tsx#sourceChip.
 */
export function sourceChip(item: Item, contentType: ContentType): SourceChip {
  if (contentType === 'carousel') {
    const n = item.media?.length ?? 0;
    return { icon: '📸', label: `Instagram Carousel · ${n} slide${n === 1 ? '' : 's'}` };
  }
  if (contentType === 'youtube') {
    return { icon: '▶️', label: 'YouTube Video', variant: 'dark' };
  }
  if (contentType === 'reel') {
    return { icon: '📸', label: 'Instagram Reel' };
  }
  if (contentType === 'receipt') {
    return { icon: '🧾', label: 'Receipt', variant: 'green' };
  }

  switch (item.type as ItemType) {
    case 'instagram':
      return { icon: '📸', label: 'Instagram Post' };
    case 'youtube':
      return { icon: '▶️', label: 'YouTube', variant: 'dark' };
    case 'url':
      return { icon: '📰', label: item.site_name || 'Article' };
    case 'screenshot':
      return { icon: '🖼', label: 'Screenshot' };
    case 'video':
      return { icon: '🎬', label: 'Video' };
    case 'pdf':
      return { icon: '📄', label: 'PDF' };
    case 'receipt':
      return { icon: '🧾', label: 'Receipt', variant: 'green' };
    case 'audio':
      return { icon: '🎧', label: 'Audio' };
    case 'screen_recording':
      return { icon: '📹', label: 'Recording' };
    case 'tiktok':
      return { icon: '🎵', label: 'TikTok' };
    case 'facebook':
      return { icon: '📘', label: 'Facebook' };
    case 'reddit':
      return { icon: '👽', label: 'Reddit' };
    case 'pinterest':
      return { icon: '📌', label: 'Pinterest' };
    case 'twitter':
      return { icon: '🐦', label: 'Tweet' };
    case 'linkedin':
      return { icon: '💼', label: 'LinkedIn' };
    case 'dribbble':
      return { icon: '🏀', label: 'Dribbble' };
    case 'drive':
      return { icon: '📁', label: 'Drive' };
    case 'file':
      return { icon: '📎', label: 'File' };
    case 'email':
      return { icon: '✉️', label: 'Email' };
    default:
      return { icon: '📎', label: 'Item' };
  }
}
