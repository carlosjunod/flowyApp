/** Portable file contract, mirrored in worker and native. Sizes are bytes. */
export const MIB = 1024 * 1024;
export const FILE_LIMITS = {
  image: 5 * MIB,
  pdf: 25 * MIB,
  file: 50 * MIB,
  batch: 100 * MIB,
  count: 10,
} as const;
export type FileAnalysisState =
  | 'uploading'
  | 'stored'
  | 'queued'
  | 'analyzing'
  | 'complete'
  | 'partial'
  | 'unsupported'
  | 'error';
export interface FileAnalysis {
  state: FileAnalysisState;
  pages?: number;
  processedPages?: number;
  omittedPages?: number[];
  message?: string;
}
export interface OriginalFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  analysis: FileAnalysis;
  originalAvailable?: boolean;
  retention?: FileRetention;
  retainUntil?: number;
  removalPending?: boolean;
}
export interface DocumentProcessing {
  state: FileAnalysisState;
  files: OriginalFile[];
}
export interface FileDescriptor {
  name: string;
  mime: string;
  size: number;
  md5?: string;
}
export interface StorageUsage {
  usedBytes: number;
  reservedBytes: number;
  pendingDeletionBytes: number;
  limitBytes: number;
  availableBytes: number;
  inventoryPending: boolean;
  plan: string;
}
export interface UploadTicket {
  index: number;
  id: string;
  url: string;
  headers: Record<string, string>;
}
export interface UploadSession {
  itemId: string;
  uploads: UploadTicket[];
  usage: StorageUsage;
}
export function fileLimit(file: Pick<FileDescriptor, 'name' | 'mime'>): number {
  if (file.mime === 'application/pdf' || /\.pdf$/i.test(file.name))
    return FILE_LIMITS.pdf;
  if (file.mime.startsWith('image/')) return FILE_LIMITS.image;
  return FILE_LIMITS.file;
}
export function validateFiles(files: FileDescriptor[]): void {
  if (
    !Array.isArray(files) ||
    !files.length ||
    files.length > FILE_LIMITS.count
  )
    throw new Error('INVALID_FILE_COUNT');
  let total = 0;
  for (const f of files) {
    if (
      !f ||
      typeof f.name !== 'string' ||
      !f.name.trim() ||
      f.name.length > 200 ||
      /[\x00-\x1f]/.test(f.name) ||
      typeof f.mime !== 'string' ||
      f.mime.length > 160 ||
      !Number.isSafeInteger(f.size) ||
      f.size <= 0
    )
      throw new Error('INVALID_FILE');
    if (f.size > fileLimit(f)) throw new Error('FILE_TOO_LARGE');
    total += f.size;
  }
  if (total > FILE_LIMITS.batch) throw new Error('BATCH_TOO_LARGE');
}
/**
 * Byte sizes with locale-aware digits ("1.5 MB" vs "1,5 MB").
 *
 * The unit symbols (B/KB/MB/GB) are international and stay as they are; only
 * the decimal separator and grouping follow the locale. Thresholds and decimal
 * places are unchanged from the original English-only implementation, so a
 * locale switch never resizes a column.
 */
export function formatFileBytes(bytes: number, locale = 'en'): string {
  const decimal = (value: number, digits: number): string => {
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch {
      return value.toFixed(digits);
    }
  };
  if (bytes < 1024) return `${decimal(bytes, 0)} B`;
  if (bytes < MIB) return `${decimal(bytes / 1024, 1)} KB`;
  return bytes >= 1024 * MIB
    ? `${decimal(bytes / (1024 * MIB), 1)} GB`
    : `${decimal(bytes / MIB, 1)} MB`;
}
/** Translation key for a document's analysis state. */
export function analysisLabelKey(state: FileAnalysisState): string {
  return `inbox.files.analysis.${state}`;
}

/** Documents use file icons until an actual image preview exists. */
export function isDocumentItem(item: {
  type: string;
  document_processing?: DocumentProcessing;
}): boolean {
  return (
    item.type === 'pdf' ||
    item.type === 'file' ||
    (item.type === 'receipt' &&
      Array.isArray(item.document_processing?.files) &&
      item.document_processing.files.some(
        (f) => f.mime === 'application/pdf' || /\.pdf$/i.test(f.name),
      ))
  );
}

/** `value` is the API contract; `labelKey` resolves under `settings.storage.retention.*`. */
export const RETENTION_OPTIONS = [
  { value: 'keep', labelKey: 'settings.storage.retention.keep' },
  { value: 'after_analysis', labelKey: 'settings.storage.retention.after_analysis' },
  { value: '7_days', labelKey: 'settings.storage.retention.7_days' },
  { value: '30_days', labelKey: 'settings.storage.retention.30_days' },
  { value: '90_days', labelKey: 'settings.storage.retention.90_days' },
] as const;
export type FileRetention = (typeof RETENTION_OPTIONS)[number]['value'];
export interface ManagedFile extends OriginalFile {
  itemId: string;
  created: string;
  duplicateCount: number;
  canRemove: boolean;
}
export interface StorageFiles {
  files: ManagedFile[];
  page: number;
  totalPages: number;
  totalFiles: number;
  duplicateBytes: number;
  retention: FileRetention;
}
export interface FilePreview {
  name: string;
  text: string;
  truncated: boolean;
  analysis: FileAnalysis;
}
