import { canResumeSemantic, readSemanticContent, semanticCoverageMessage } from './semantic';

/** Portable presentation contract. Mirrored byte-for-byte by the native client. */
export const READER_COPY = {
  takeaways: 'FLOWY AI · TAKEAWAYS',
  authorSaves: 'Your saves from this author',
  markRead: 'Mark as read',
  markUnread: 'Mark as unread',
  readingHint: 'Opening a save doesn’t mark it as read.',
  original: 'Original content',
  savedText: 'Saved text',
  research: 'Related sources',
  researchHint: 'Find useful links mentioned in this save and summarize what they add.',
  noSummary: 'No summary is available yet. You can read the original below.',
  pendingSummary: 'Your summary will appear when processing finishes.',
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
  const complete = !resume && !resource && item.exploration?.status === 'enriched' && Boolean(item.exploration.deep_analysis);
  const receipt = item.type === 'receipt';
  const label = busy ? (resume ? 'Reading saved content…' : receipt ? 'Analyzing receipt…' : 'Researching links…')
    : resume ? (failed ? 'Retry extraction' : 'Continue extraction')
    : complete ? (receipt ? 'Receipt analyzed' : 'Research complete')
    : failed ? (receipt ? 'Retry analysis' : 'Retry research')
    : receipt ? 'Analyze this receipt' : resource ? 'Find resource links' : 'Research related links';
  return { resume, busy, complete, failed, label, disabled: busy || complete || item.status !== 'ready',
    coverage: semantic ? semanticCoverageMessage(semantic) : undefined,
    hint: resume ? 'Completed work is kept. Read the remaining saved content.' : READER_COPY.researchHint };
}

export function readerSummary(item: ReaderItem) {
  return item.summary?.trim() || (['ready', 'error'].includes(item.status) ? READER_COPY.noSummary : READER_COPY.pendingSummary);
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

export function readerDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ResearchData {
  primary_link?: { title: string; url: string };
  candidates?: { name: string; url?: string; reason?: string }[];
  notes?: string;
  deep_analysis?: { synthesis?: string; key_findings?: string[]; link_excerpts?: { title: string; url: string; excerpt: string }[] };
  video_insights?: { frames_analyzed: number; on_screen_text?: string; visual_cues?: string[] };
}
export interface ResearchSection { label: string; text?: string; links?: { title: string; url?: string; detail?: string }[] }
/** Full source evidence is retained; absent data never becomes a placeholder section. */
export function readerResearch(data: ResearchData): ResearchSection[] {
  const sections: ResearchSection[] = [];
  const deep = data.deep_analysis;
  if (deep?.synthesis) sections.push({ label: 'Research summary', text: deep.synthesis });
  if (deep?.key_findings?.length) sections.push({ label: 'Key findings from links', text: deep.key_findings.map((line, index) => `${index + 1}. ${line}`).join('\n\n') });
  const links = [
    ...(data.primary_link ? [{ title: data.primary_link.title || data.primary_link.url, url: data.primary_link.url, detail: 'Primary source' }] : []),
    ...(data.candidates ?? []).map(link => ({ title: link.name, url: link.url, detail: `Possible match${link.reason ? ` · ${link.reason}` : ''}` })),
  ];
  if (links.length) sections.push({ label: 'Related sources', links });
  if (deep?.link_excerpts?.length) sections.push({ label: 'Link excerpts', links: deep.link_excerpts.map(link => ({ title: link.title || link.url, url: link.url, detail: link.excerpt })) });
  if (data.video_insights) {
    const video = data.video_insights;
    sections.push({ label: 'Image analysis', text: [`${video.frames_analyzed} frames analyzed`, video.on_screen_text, video.visual_cues?.join('\n\n')].filter(Boolean).join('\n\n') });
  }
  if (data.notes) sections.push({ label: 'Research notes', text: data.notes });
  return sections;
}
