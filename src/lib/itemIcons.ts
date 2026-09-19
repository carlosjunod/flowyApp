import type { Feather } from '@expo/vector-icons';
import type { ItemType } from '@/types';

export type ItemIconName = keyof typeof Feather.glyphMap;

/** App-owned item symbols use the same outline icon family as navigation. */
export const itemTypeIcon: Record<ItemType, ItemIconName> = {
  url: 'link', screenshot: 'image', youtube: 'youtube', video: 'film',
  receipt: 'file-text', pdf: 'file-text', audio: 'headphones', reddit: 'message-circle',
  instagram: 'instagram', screen_recording: 'video', pinterest: 'bookmark',
  dribbble: 'dribbble', linkedin: 'linkedin', twitter: 'twitter', tiktok: 'music',
  facebook: 'facebook', drive: 'folder', file: 'paperclip', email: 'mail',
};

/**
 * Translation key for each `item.type`.
 *
 * The enum value itself is an API contract and is never translated; only the
 * human name shown beside it is. Every key resolves under `inbox.types.*`.
 */
export const itemTypeLabelKey: Record<ItemType, string> = {
  url: 'inbox.types.url', screenshot: 'inbox.types.screenshot', youtube: 'inbox.types.youtube',
  video: 'inbox.types.video', receipt: 'inbox.types.receipt', pdf: 'inbox.types.pdf',
  audio: 'inbox.types.audio', reddit: 'inbox.types.reddit', instagram: 'inbox.types.instagram',
  screen_recording: 'inbox.types.screen_recording', pinterest: 'inbox.types.pinterest',
  dribbble: 'inbox.types.dribbble', linkedin: 'inbox.types.linkedin',
  twitter: 'inbox.types.twitter', tiktok: 'inbox.types.tiktok',
  facebook: 'inbox.types.facebook', drive: 'inbox.types.drive', file: 'inbox.types.file',
  email: 'inbox.types.email',
};
