// Native reading of the server's optional digest editorial edition (Flowy D-039).
// Mirrors apps/web/lib/digest/editorial/contract.ts semantics without zod: invalid or
// absent editions render typographically, and only https (or dev loopback) URLs are used.
import type {
  DigestContent,
  DigestEditorial,
  DigestEditorialImage,
  DigestEditorialPlacement,
  DigestEditorialSection,
  DigestEditorialVariant,
  DigestPresentation,
} from '@/types';

export const EDITORIAL_SECTIONS: DigestEditorialSection[] = ['ideas', 'themes', 'highlights', 'connections'];
export const AI_ILLUSTRATION_LABEL = {
  es: 'Ilustración editorial generada con IA',
  en: 'AI-generated editorial illustration',
} as const;
export const SECTION_LABEL: Record<'en' | 'es', Record<DigestEditorialSection, string>> = {
  es: { ideas: 'Ideas', themes: 'Temas', highlights: 'Destacados', connections: 'Conexiones' },
  en: { ideas: 'Ideas', themes: 'Themes', highlights: 'Highlights', connections: 'Connections' },
};
export const CADENCE_LABEL = {
  es: { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual' },
  en: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' },
} as const;

const IMAGE_ID = /^[a-z]+(?:-[a-z]+)*-0[1-6]$/;
const VARIANT_KEY = /^editorial\/digests\/[a-z0-9-]+\/variants\/[a-z-]+-0[1-6]\/\d{2,4}w-[0-9a-f]{16}\.(?:webp|jpg)$/;

export function safeAssetUrl(value: unknown, allowLoopback = false): value is string {
  if (typeof value !== 'string' || value.length > 600) return false;
  const match = /^(https?):\/\/([^/?#@]+)(\/[^?#]*)$/.exec(value);
  if (!match) return false;
  if (match[1] === 'https') return true;
  const host = match[2]!.replace(/:\d{2,5}$/, '');
  return allowLoopback && (host === '127.0.0.1' || host === 'localhost');
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isDimension = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4096;
const isText = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;

function isVariantList(value: unknown, allowLoopback: boolean): value is DigestEditorialVariant[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 3 &&
    value.every((v) => isRecord(v) && isDimension(v.w) && isDimension(v.h) && typeof v.key === 'string' && VARIANT_KEY.test(v.key) && safeAssetUrl(v.url, allowLoopback))
  );
}

function isImage(value: unknown, allowLoopback: boolean): value is DigestEditorialImage {
  if (!isRecord(value) || typeof value.id !== 'string' || !IMAGE_ID.test(value.id)) return false;
  const focal = value.focal_point, alt = value.alt, variants = value.variants;
  return (
    value.kind === 'ai_editorial_illustration' &&
    isDimension(value.width) &&
    isDimension(value.height) &&
    isRecord(focal) && typeof focal.x === 'number' && focal.x >= 0 && focal.x <= 1 && typeof focal.y === 'number' && focal.y >= 0 && focal.y <= 1 &&
    isRecord(alt) && isText(alt.es, 200) && isText(alt.en, 200) &&
    isRecord(variants) && isVariantList(variants.webp, allowLoopback) && isVariantList(variants.jpeg, allowLoopback)
  );
}

function isPlacement(value: unknown, slot: 'cover' | 'interior', allowLoopback: boolean): value is DigestEditorialPlacement {
  if (!isRecord(value) || value.slot !== slot || !isImage(value.image, allowLoopback)) return false;
  return slot === 'cover'
    ? value.section === 'cover' && value.block_id === null
    : EDITORIAL_SECTIONS.includes(value.section as DigestEditorialSection) && isText(value.block_id, 64);
}

/** Validated illustrated edition, or null when absent, invalid, typographic or disabled by the server. */
export function readEdition(
  content: Pick<DigestContent, 'editorial'> | undefined,
  presentation: Pick<DigestPresentation, 'editorial'> | undefined,
  allowLoopback = false,
): DigestEditorial | null {
  // Older servers omit `presentation`: they never publish editions, so absence means off.
  if (!presentation?.editorial || !content || !isRecord(content.editorial)) return null;
  const edition: Record<string, unknown> = content.editorial;
  if (edition.version !== 1 || edition.mode !== 'illustrated') return null;
  const catalogVersion = edition.catalog_version, selectorVersion = edition.selector_version;
  if (typeof catalogVersion !== 'string' || typeof selectorVersion !== 'string' || !catalogVersion || !selectorVersion) return null;
  if (!isPlacement(edition.cover, 'cover', allowLoopback)) return null;
  const cover = edition.cover;
  const interior: unknown[] = Array.isArray(edition.interior) ? edition.interior : [];
  const ids = new Set([cover.image.id]);
  const unique = interior
    .filter((p): p is DigestEditorialPlacement => isPlacement(p, 'interior', allowLoopback))
    .filter((p) => !ids.has(p.image.id) && Boolean(ids.add(p.image.id)))
    .slice(0, 2);
  return {
    version: 1,
    catalog_version: catalogVersion.slice(0, 80),
    selector_version: selectorVersion.slice(0, 80),
    mode: 'illustrated',
    cover,
    interior: unique,
  };
}

export function placementFor(edition: DigestEditorial | null, section: DigestEditorialSection, blockId: string) {
  return edition?.interior.find((p) => p.section === section && p.block_id === blockId) ?? null;
}

/** Smallest JPEG at least `minWidth` pixels wide (device pixels), else the largest. */
export function pickVariant(image: DigestEditorialImage, minWidth: number): DigestEditorialVariant {
  const list = [...image.variants.jpeg].sort((a, b) => a.w - b.w);
  return list.find((v) => v.w >= minWidth) ?? list[list.length - 1]!;
}

/** Exclusive `end` → last covered day; matches the server/web label. */
export function periodLabel(start: string, end: string, timezone: string | undefined, locale: 'en' | 'es') {
  const from = Date.parse(start),
    to = Date.parse(end) - 1;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return '';
  const tag = locale === 'es' ? 'es-ES' : 'en-US';
  let zone = timezone || 'UTC';
  try {
    new Intl.DateTimeFormat(tag, { timeZone: zone });
  } catch {
    zone = 'UTC';
  }
  const day = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', timeZone: zone });
  const year = new Intl.DateTimeFormat(tag, { year: 'numeric', timeZone: zone });
  const full = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', timeZone: zone });
  if (full.format(from) === full.format(to)) return full.format(from);
  return (year.format(from) === year.format(to) ? day.format(from) : full.format(from)) + ' – ' + full.format(to);
}
