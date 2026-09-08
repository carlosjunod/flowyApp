/** Portable contract. Mirrored in worker/src/lib/semantic/types.ts and Expo src/types/semantic.ts. */
export type SemanticKind = 'repository' | 'movie' | 'book' | 'product' | 'place' | 'paper' | 'other';
export type SemanticSourceKind = 'source_text' | 'caption' | 'ocr' | 'transcript' | 'comment';
export type SemanticLayout = 'list' | 'entity' | 'narrative' | 'generic';
export type SemanticIssue = 'no_source_text' | 'boilerplate' | 'generated_text_removed' | 'announced_count_mismatch' | 'segment_budget' | 'segment_failed' | 'segment_incomplete' | 'entry_rejected' | 'entry_limit' | 'payload_limit' | 'source_limit' | 'conflicting_counts';
export interface SemanticExtraction {
  sourceStatus: 'usable' | 'insufficient';
  issues: SemanticIssue[];
  announced?: { count: number; quote: string; section: string };
  totalSegments: number;
  completedSegments: number[];
  unusableSegments?: number[];
  nextSegment: number;
  layouts: SemanticLayout[];
}
export interface SemanticEntry {
  id: string;
  kind: SemanticKind;
  name: string;
  description?: string;
  evidence: { quote: string; section?: string; slideIndex?: number; seconds?: number; origin?: SemanticSourceKind }[];
  links: { url: string; relation: 'mentioned' | 'canonical' | 'reference'; origin: 'source' | 'lookup'; verifiedAt?: string }[];
  resolution: 'unresolved' | 'resolved' | 'ambiguous';
  lastResolutionAttemptAt?: string;
}
export interface SemanticContentV1 {
  schema: 'semantic-content';
  version: 1;
  layout: SemanticLayout;
  domain: string;
  title?: string;
  overview?: string;
  entries: SemanticEntry[];
  coverage: 'complete' | 'partial' | 'unknown';
  sourceHash: string;
  extractorVersion: number;
  /** Optional for V1 records. Progress contains references only, never copies of source text. */
  extraction?: SemanticExtraction;
}
export const SEMANTIC_MAX_ENTRIES = 120;
export function safeSemanticUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function str(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function optionalString(value: unknown, max: number): boolean { return value === undefined || str(value, max); }
function optionalIndex(value: unknown): boolean { return value === undefined || (Number.isSafeInteger(value) && Number(value) >= 0); }
const kinds: readonly string[] = ['repository', 'movie', 'book', 'product', 'place', 'paper', 'other'];
const origins: readonly string[] = ['source_text', 'caption', 'ocr', 'transcript', 'comment'];
const layouts: readonly string[] = ['list', 'entity', 'narrative', 'generic'];
const issues: readonly string[] = ['no_source_text', 'boilerplate', 'generated_text_removed', 'announced_count_mismatch', 'segment_budget', 'segment_failed', 'segment_incomplete', 'entry_rejected', 'entry_limit', 'payload_limit', 'source_limit', 'conflicting_counts'];
function extraction(value: unknown): boolean {
  if (value === undefined) return true;
  if (!record(value) || !['usable', 'insufficient'].includes(String(value.sourceStatus)) ||
      !Array.isArray(value.issues) || value.issues.length > issues.length || !value.issues.every(i => issues.includes(String(i))) ||
      !Number.isSafeInteger(value.totalSegments) || Number(value.totalSegments) < 0 || Number(value.totalSegments) > 512 ||
      !Array.isArray(value.completedSegments) || value.completedSegments.length > Number(value.totalSegments) ||
      new Set(value.completedSegments).size !== value.completedSegments.length ||
      !value.completedSegments.every(i => Number.isSafeInteger(i) && Number(i) >= 0 && Number(i) < Number(value.totalSegments)) ||
      !Number.isSafeInteger(value.nextSegment) || Number(value.nextSegment) < 0 || Number(value.nextSegment) >= Math.max(1, Number(value.totalSegments)) ||
      !Array.isArray(value.layouts) || value.layouts.length > 4 || !value.layouts.every(l => layouts.includes(String(l)))) return false;
  if (value.unusableSegments !== undefined && (!Array.isArray(value.unusableSegments) || value.unusableSegments.length > value.completedSegments.length ||
      new Set(value.unusableSegments).size !== value.unusableSegments.length || !value.unusableSegments.every(i => (value.completedSegments as unknown[]).includes(i)))) return false;
  const a = value.announced;
  return a === undefined || (record(a) && Number.isSafeInteger(a.count) && Number(a.count) > 1 && Number(a.count) <= 999 && str(a.quote, 600) && str(a.section, 120));
}
/** Reject an invalid/unknown envelope as a whole; old receipts remain untouched. */
export function readSemanticContent(value: unknown): SemanticContentV1 | null {
  if (!record(value) || value.schema !== 'semantic-content' || value.version !== 1 ||
      !['list', 'entity', 'narrative', 'generic'].includes(String(value.layout)) ||
      !['complete', 'partial', 'unknown'].includes(String(value.coverage)) ||
      !str(value.domain, 80) || !str(value.sourceHash, 64) || !/^[a-f0-9]{64}$/.test(value.sourceHash) ||
      !Number.isSafeInteger(value.extractorVersion) || Number(value.extractorVersion) < 1 ||
      !optionalString(value.title, 200) || !optionalString(value.overview, 1200) ||
      !Array.isArray(value.entries) || value.entries.length > SEMANTIC_MAX_ENTRIES || !extraction(value.extraction)) return null;
  if ((value.layout === 'entity' && value.entries.length !== 1) ||
      (value.layout === 'list' && !value.entries.length) ||
      ((value.layout === 'narrative' || value.layout === 'generic') && value.entries.length)) return null;
  const ids = new Set<string>();
  for (const e of value.entries) {
    if (!record(e) || !str(e.id, 80) || ids.has(e.id) || !kinds.includes(String(e.kind)) || !str(e.name, 200) ||
        !optionalString(e.description, 600) || !optionalString(e.lastResolutionAttemptAt, 40) ||
        (e.lastResolutionAttemptAt !== undefined && !Number.isFinite(Date.parse(String(e.lastResolutionAttemptAt)))) || !['unresolved', 'resolved', 'ambiguous'].includes(String(e.resolution)) ||
        !Array.isArray(e.evidence) || !e.evidence.length || e.evidence.length > 3 ||
        !Array.isArray(e.links) || e.links.length > 5) return null;
    ids.add(e.id);
    for (const proof of e.evidence) {
      if (!record(proof) || !str(proof.quote, 600) || !optionalString(proof.section, 120) ||
          !optionalIndex(proof.slideIndex) || !optionalIndex(proof.seconds) ||
          (proof.origin !== undefined && !origins.includes(String(proof.origin)))) return null;
    }
    for (const link of e.links) {
      if (!record(link) || !safeSemanticUrl(link.url) ||
          !['mentioned', 'canonical', 'reference'].includes(String(link.relation)) ||
          !['source', 'lookup'].includes(String(link.origin)) ||
          !optionalString(link.verifiedAt, 40) ||
          (link.origin === 'lookup' && (typeof link.verifiedAt !== 'string' || !Number.isFinite(Date.parse(link.verifiedAt))))) return null;
    }
    if (e.resolution === 'resolved' && !e.links.some(l => record(l) && l.relation === 'canonical')) return null;
  }
  return value as unknown as SemanticContentV1;
}
const singular: Record<SemanticKind, string> = { repository: 'repository', movie: 'movie', book: 'book', product: 'product', place: 'place', paper: 'paper', other: 'item' };
const plural: Record<SemanticKind, string> = { repository: 'repositories', movie: 'movies', book: 'books', product: 'products', place: 'places', paper: 'papers', other: 'items' };
export function semanticLabel(content: SemanticContentV1): string {
  if (content.layout === 'list') {
    const kind = content.entries[0]?.kind ?? 'other';
    const uniform = content.entries.every(e => e.kind === kind);
    return `List · ${content.entries.length} ${content.entries.length === 1 ? singular[kind] : uniform ? plural[kind] : 'items'}${content.coverage === 'partial' ? ' · partial' : ''}`;
  }
  return content.layout === 'entity' ? 'Resource' : content.layout === 'narrative' ? 'Story' : 'Saved content';
}
export function canResumeSemantic(content: SemanticContentV1 | null): boolean {
  const state = content?.extraction;
  return Boolean(state && state.sourceStatus === 'usable' && state.completedSegments.length < state.totalSegments &&
    !state.issues.some(i => i === 'entry_limit' || i === 'payload_limit'));
}
export function semanticCoverageMessage(content: SemanticContentV1): string | undefined {
  const state = content.extraction;
  if (state?.sourceStatus === 'insufficient') return 'The saved source does not contain enough readable text. The original is still available below.';
  if (canResumeSemantic(content)) return 'Part of the saved source still needs to be read. Continue extraction to recover the remaining content.';
  if (state?.issues.includes('announced_count_mismatch') && state.announced) return `The source announces ${state.announced.count} resources; ${content.entries.length} ${content.entries.length === 1 ? 'was' : 'were'} recovered. Review the source for missing or additional entries.`;
  if (content.coverage === 'partial') return 'Some content could not be extracted.';
  return undefined;
}
export function semanticEvidenceLabel(origin?: SemanticSourceKind): string {
  return origin === 'caption' ? 'Original caption' : origin === 'ocr' ? 'Text read from image' : origin === 'transcript' ? 'Audio transcript' : origin === 'comment' ? 'Reader comment' : 'Saved text';
}
