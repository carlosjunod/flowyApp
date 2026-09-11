import type { ShareIntent, ShareIntentFile } from 'expo-share-intent';

import type { IngestPayload, IngestType, SharedFile } from '@/types';

const MAX_IMAGES = 10;
const MAX_FILES = 10;

type SharedAsset = Pick<ShareIntentFile, 'fileName' | 'mimeType' | 'path'>;
type FileReader = (file: SharedAsset) => Promise<string>;

const urlPattern = /https?:\/\/[^\s<>()]+/i;

/** Keep Android's social-link routing aligned with the iOS extension. */
export const classifySharedUrl = (value: string): IngestType => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
  if (host.endsWith('reddit.com') || host === 'redd.it') return 'reddit';
  if (host.endsWith('instagram.com') && (path.includes('/p/') || path.includes('/reel/') || path.includes('/tv/'))) return 'instagram';
  if (host.endsWith('tiktok.com')) return 'video';
  if (host.endsWith('pinterest.com') || host.endsWith('pin.it')) return 'pinterest';
  if (host.endsWith('dribbble.com')) return 'dribbble';
  if (host.endsWith('linkedin.com') || host.endsWith('lnkd.in')) return 'linkedin';
  if (host.endsWith('twitter.com') || host.endsWith('x.com') || host.endsWith('t.co')) return 'twitter';
  return 'url';
};

const sharedUrl = (intent: ShareIntent): string | null => {
  const candidate = intent.webUrl ?? intent.text?.match(urlPattern)?.[0] ?? null;
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const mimeFor = (file: SharedAsset): string => file.mimeType?.toLowerCase() || 'application/octet-stream';

const shareFile = async (file: SharedAsset, readFile: FileReader): Promise<SharedFile> => ({
  name: file.fileName || 'file',
  mime: mimeFor(file),
  data: await readFile(file),
});

/**
 * Applies the iOS extension's ordering: video, URL, PDFs, images, then files.
 * It is deliberately independent of Android APIs so the selection policy stays
 * easy to test and cannot drift from the server's ingest contract.
 */
export const payloadFromShareIntent = async (
  intent: ShareIntent,
  readFile: FileReader,
): Promise<IngestPayload | null> => {
  const files = (intent.files ?? []).filter((file): file is ShareIntentFile => !!file.path);
  const video = files.find((file) => mimeFor(file).startsWith('video/'));
  if (video) {
    return {
      type: 'screen_recording',
      raw_video: await readFile(video),
      video_mime: mimeFor(video),
    };
  }

  const url = sharedUrl(intent);
  if (url) return { type: classifySharedUrl(url), raw_url: url };

  const pdfs = files.filter((file) => mimeFor(file) === 'application/pdf').slice(0, MAX_FILES);
  if (pdfs.length) {
    const encoded = await Promise.all(pdfs.map((file) => shareFile(file, readFile)));
    return encoded.length === 1
      ? { type: 'pdf', raw_pdf: encoded[0] }
      : { type: 'pdf', raw_pdfs: encoded };
  }

  const images = files.filter((file) => mimeFor(file).startsWith('image/')).slice(0, MAX_IMAGES);
  if (images.length) {
    const encoded = await Promise.all(images.map(readFile));
    return encoded.length === 1
      ? { type: 'screenshot', raw_image: encoded[0] }
      : { type: 'screenshot', raw_images: encoded };
  }

  const genericFiles = files.slice(0, MAX_FILES);
  if (!genericFiles.length) return null;
  const encoded = await Promise.all(genericFiles.map((file) => shareFile(file, readFile)));
  return encoded.length === 1
    ? { type: 'file', raw_file: encoded[0] }
    : { type: 'file', raw_files: encoded };
};

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Encodes bytes without Node's Buffer, which is unavailable in Hermes. */
export const base64FromArrayBuffer = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += base64Alphabet[first >> 2];
    result += base64Alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    result += second === undefined ? '=' : base64Alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    result += third === undefined ? '=' : base64Alphabet[third & 63];
  }
  return result;
};

/** Android's native module copies shared content into app-readable cache storage. */
export const readSharedFileBase64 = async (file: SharedAsset): Promise<string> => {
  const response = await fetch(file.path);
  if (!response.ok) throw new Error(`Could not read shared file (${response.status})`);
  return base64FromArrayBuffer(await response.arrayBuffer());
};
