import { canResumeSemantic, readSemanticContent, semanticCoverageKey } from './semantic';

/**
 * Portable presentation contract. Byte-identical in `apps/web/types/reader.ts`
 * and Expo `src/types/reader.ts` — `tests/unit/reader-parity.test.tsx` enforces
 * it, so this comment is written to read correctly in both copies.
 *
 * Values are TRANSLATION KEYS, not sentences: the rules live here once and each
 * platform renders them through its own dictionary. Every key below must exist
 * under `inbox.reader.*` in the web dictionary AND the Expo dictionary.
 */
export const READER_COPY = {
  takeaways: 'inbox.reader.takeaways',
  authorSaves: 'inbox.reader.authorSaves',
  markRead: 'inbox.reader.markRead',
  markUnread: 'inbox.reader.markUnread',
  readingHint: 'inbox.reader.readingHint',
  original: 'inbox.reader.original',
  savedText: 'inbox.reader.savedText',
  research: 'inbox.reader.research',
  researchHint: 'inbox.reader.researchHint',
  noSummary: 'inbox.reader.noSummary',
  pendingSummary: 'inbox.reader.pendingSummary',
} as const;

export interface ReaderItem {
  type: string;
  status: string;
  summary?: string;
  structured_content?: unknown;
  exploration?: { status: string; deep_analysis?: unknown };
}

export function readerAction(item: ReaderItem, starting = false) {
  const semantic = item.type === 'receipt' ? null : readSemanticContent(item.structured_content);
  const resume = canResumeSemantic(semantic);
  const resource = semantic?.layout === 'entity' || semantic?.layout === 'list';
  const busy = starting || item.exploration?.status === 'exploring';
  const failed = item.exploration?.status === 'error';
  const unresolved = resource && semantic.entries.some(entry => entry.linkable !== false && entry.resolution !== 'resolved');
  const complete = !resume && !unresolved && item.exploration?.status === 'enriched' && Boolean(item.exploration.deep_analysis);
  const receipt = item.type === 'receipt';
  const labelKey = busy ? (resume ? 'inbox.reader.readingSaved' : receipt ? 'inbox.reader.analyzingReceipt' : 'inbox.reader.deepInProgress')
    : resume ? (failed ? 'inbox.reader.retryExtraction' : 'inbox.reader.continueExtraction')
    : complete ? (receipt ? 'inbox.reader.receiptAnalyzed' : 'inbox.reader.deepComplete')
    : failed ? (receipt ? 'inbox.reader.retryAnalysis' : 'inbox.reader.retryDeep')
    : receipt ? 'inbox.reader.analyzeReceipt' : 'inbox.reader.deepDive';
  return { resume, busy, complete, failed, labelKey, disabled: busy || complete || item.status !== 'ready',
    coverage: semantic ? semanticCoverageKey(semantic) : undefined,
    hintKey: resume ? 'inbox.reader.resumeHint'
      : !busy && item.exploration?.status === 'no_match'
        ? resource && semantic.entries.every(entry => entry.linkable === false)
          ? 'inbox.reader.noResourcesHint'
          : 'inbox.reader.noLinksHint'
        : READER_COPY.researchHint };
}

/** Returns the summary text, or the key of the placeholder to render. */
export function readerSummary(item: ReaderItem): { text: string } | { key: string } {
  const text = item.summary?.trim();
  if (text) return { text };
  return { key: ['ready', 'error'].includes(item.status) ? READER_COPY.noSummary : READER_COPY.pendingSummary };
}

export function distinctOverview(overview?: string, summary?: string) {
  const normalize = (text?: string) => text?.replace(/\s+/g, ' ').trim().toLowerCase();
  return overview?.trim() && normalize(overview) !== normalize(summary) ? overview : undefined;
}

/** Instagram's r2_key may contain the poster even when the source is a video. */
export function savedMediaKind(key?: string): 'image' | 'video' | 'unknown' {
  const path = key?.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (/\.(?:jpe?g|png|webp|gif|avif|heic)$/.test(path)) return 'image';
  if (/\.(?:mp4|m4v|mov|webm)$/.test(path)) return 'video';
  return 'unknown';
}

/** Locale-aware medium date. `locale` is threaded in so neither platform has
 *  to reach for ambient state; it defaults to the previous en-US behaviour. */
export function readerDate(value: string, locale = 'en-US') {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  try {
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

interface ResearchData {
  primary_link?: { title: string; url: string };
  candidates?: { name: string; url?: string; reason?: string }[];
  notes?: string;
  deep_analysis?: { synthesis?: string; key_findings?: string[]; link_excerpts?: { title: string; url: string; excerpt: string }[] };
  video_insights?: { frames_analyzed: number; on_screen_text?: string; visual_cues?: string[] };
}
export interface ResearchLink {
  title: string;
  url?: string;
  /** Free text from the model — rendered as-is, never translated. */
  detail?: string;
  /** Translation key + vars for a generated caption (e.g. "Primary source"). */
  detailKey?: string;
  detailVars?: Record<string, string | number>;
}
export interface ResearchSection {
  labelKey: string;
  text?: string;
  /** Present when the body itself is generated rather than model output. */
  textKey?: string;
  textVars?: Record<string, string | number>;
  links?: ResearchLink[];
}
/** Full source evidence is retained; absent data never becomes a placeholder section. */
export function readerResearch(data: ResearchData): ResearchSection[] {
  const sections: ResearchSection[] = [];
  const deep = data.deep_analysis;
  if (deep?.synthesis) sections.push({ labelKey: 'inbox.reader.sections.researchSummary', text: deep.synthesis });
  if (deep?.key_findings?.length) sections.push({ labelKey: 'inbox.reader.sections.keyFindings', text: deep.key_findings.map((line, index) => `${index + 1}. ${line}`).join('\n\n') });
  const links: ResearchLink[] = [
    ...(data.primary_link ? [{ title: data.primary_link.title || data.primary_link.url, url: data.primary_link.url, detailKey: 'inbox.reader.sections.primarySource' }] : []),
    ...(data.candidates ?? []).map(link => (link.reason
      ? { title: link.name, url: link.url, detailKey: 'inbox.reader.sections.possibleMatchReason', detailVars: { reason: link.reason } }
      : { title: link.name, url: link.url, detailKey: 'inbox.reader.sections.possibleMatch' })),
  ];
  if (links.length) sections.push({ labelKey: 'inbox.reader.sections.relatedSources', links });
  if (deep?.link_excerpts?.length) sections.push({ labelKey: 'inbox.reader.sections.linkExcerpts', links: deep.link_excerpts.map(link => ({ title: link.title || link.url, url: link.url, detail: link.excerpt })) });
  if (data.video_insights) {
    const video = data.video_insights;
    sections.push({
      labelKey: 'inbox.reader.sections.imageAnalysis',
      textKey: 'inbox.reader.sections.framesAnalyzed',
      textVars: { count: video.frames_analyzed },
      text: [video.on_screen_text, video.visual_cues?.join('\n\n')].filter(Boolean).join('\n\n'),
    });
  }
  if (data.notes) sections.push({ labelKey: 'inbox.reader.sections.researchNotes', text: data.notes });
  return sections;
}
