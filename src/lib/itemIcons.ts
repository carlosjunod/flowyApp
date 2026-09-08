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

export const itemTypeLabel: Record<ItemType, string> = {
  url: 'Link', screenshot: 'Screenshot', youtube: 'YouTube', video: 'Video',
  receipt: 'Receipt', pdf: 'PDF', audio: 'Audio', reddit: 'Reddit',
  instagram: 'Instagram', screen_recording: 'Recording', pinterest: 'Pinterest',
  dribbble: 'Dribbble', linkedin: 'LinkedIn', twitter: 'Twitter', tiktok: 'TikTok',
  facebook: 'Facebook', drive: 'Drive', file: 'File', email: 'Email',
};
