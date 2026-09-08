import type { ItemIconName } from './itemIcons';
import type { ContentType } from './contentType';
import type { Item, ItemType } from '@/types';

export type SourceChip = {
  icon: ItemIconName;
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
    return { icon: 'instagram', label: `Instagram Carousel · ${n} slide${n === 1 ? '' : 's'}` };
  }
  if (contentType === 'youtube') {
    return { icon: 'youtube', label: 'YouTube Video', variant: 'dark' };
  }
  if (contentType === 'reel') {
    return { icon: 'instagram', label: 'Instagram Reel' };
  }
  if (contentType === 'receipt') {
    return { icon: 'file-text', label: 'Receipt', variant: 'green' };
  }

  switch (item.type as ItemType) {
    case 'instagram':
      return { icon: 'instagram', label: 'Instagram Post' };
    case 'youtube':
      return { icon: 'youtube', label: 'YouTube', variant: 'dark' };
    case 'url':
      return { icon: 'file-text', label: item.site_name || 'Article' };
    case 'screenshot':
      return { icon: 'image', label: 'Screenshot' };
    case 'video':
      return { icon: 'film', label: 'Video' };
    case 'pdf':
      return { icon: 'file-text', label: 'PDF' };
    case 'receipt':
      return { icon: 'file-text', label: 'Receipt', variant: 'green' };
    case 'audio':
      return { icon: 'headphones', label: 'Audio' };
    case 'screen_recording':
      return { icon: 'video', label: 'Recording' };
    case 'tiktok':
      return { icon: 'music', label: 'TikTok' };
    case 'facebook':
      return { icon: 'facebook', label: 'Facebook' };
    case 'reddit':
      return { icon: 'message-circle', label: 'Reddit' };
    case 'pinterest':
      return { icon: 'bookmark', label: 'Pinterest' };
    case 'twitter':
      return { icon: 'twitter', label: 'Tweet' };
    case 'linkedin':
      return { icon: 'linkedin', label: 'LinkedIn' };
    case 'dribbble':
      return { icon: 'dribbble', label: 'Dribbble' };
    case 'drive':
      return { icon: 'folder', label: 'Drive' };
    case 'file':
      return { icon: 'paperclip', label: 'File' };
    case 'email':
      return { icon: 'mail', label: 'Email' };
    default:
      return { icon: 'paperclip', label: 'Item' };
  }
}
