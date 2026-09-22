import type { ItemIconName } from './itemIcons';
import type { ContentType } from './contentType';
import type { Item, ItemType } from '@/types';

export type SourceChip = {
  icon: ItemIconName;
  /** Translation key under `inbox.sourceChip.*`. */
  labelKey: string;
  /** Interpolation payload for `labelKey` (e.g. the carousel slide count). */
  labelVars?: Record<string, string | number>;
  /**
   * Source-provided text that replaces the translated label when present.
   *
   * Only `site_name` populates this today: a publisher's own name is content,
   * not interface copy, so it is shown verbatim in every language.
   */
  labelText?: string;
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
    return {
      icon: 'instagram',
      labelKey: 'inbox.sourceChip.carousel',
      labelVars: { count: item.media?.length ?? 0 },
    };
  }
  if (contentType === 'youtube') {
    return { icon: 'youtube', labelKey: 'inbox.sourceChip.youtubeVideo', variant: 'dark' };
  }
  if (contentType === 'reel') {
    return { icon: 'instagram', labelKey: 'inbox.sourceChip.reel' };
  }
  if (contentType === 'receipt') {
    return { icon: 'file-text', labelKey: 'inbox.sourceChip.receipt', variant: 'green' };
  }

  switch (item.type as ItemType) {
    case 'instagram':
      return { icon: 'instagram', labelKey: 'inbox.sourceChip.instagramPost' };
    case 'youtube':
      return { icon: 'youtube', labelKey: 'inbox.sourceChip.youtube', variant: 'dark' };
    case 'url':
      return { icon: 'file-text', labelKey: 'inbox.sourceChip.article', labelText: item.site_name };
    case 'screenshot':
      return { icon: 'image', labelKey: 'inbox.sourceChip.screenshot' };
    case 'video':
      return { icon: 'film', labelKey: 'inbox.sourceChip.video' };
    case 'pdf':
      return { icon: 'file-text', labelKey: 'inbox.sourceChip.pdf' };
    case 'receipt':
      return { icon: 'file-text', labelKey: 'inbox.sourceChip.receipt', variant: 'green' };
    case 'audio':
      return { icon: 'headphones', labelKey: 'inbox.sourceChip.audio' };
    case 'screen_recording':
      return { icon: 'video', labelKey: 'inbox.sourceChip.recording' };
    case 'tiktok':
      return { icon: 'music', labelKey: 'inbox.sourceChip.tiktok' };
    case 'facebook':
      return { icon: 'facebook', labelKey: 'inbox.sourceChip.facebook' };
    case 'reddit':
      return { icon: 'message-circle', labelKey: 'inbox.sourceChip.reddit' };
    case 'pinterest':
      return { icon: 'bookmark', labelKey: 'inbox.sourceChip.pinterest' };
    case 'twitter':
      return { icon: 'twitter', labelKey: 'inbox.sourceChip.tweet' };
    case 'linkedin':
      return { icon: 'linkedin', labelKey: 'inbox.sourceChip.linkedin' };
    case 'dribbble':
      return { icon: 'dribbble', labelKey: 'inbox.sourceChip.dribbble' };
    case 'drive':
      return { icon: 'folder', labelKey: 'inbox.sourceChip.drive' };
    case 'file':
      return { icon: 'paperclip', labelKey: 'inbox.sourceChip.file' };
    case 'email':
      return { icon: 'mail', labelKey: 'inbox.sourceChip.email' };
    default:
      return { icon: 'paperclip', labelKey: 'inbox.sourceChip.item' };
  }
}
