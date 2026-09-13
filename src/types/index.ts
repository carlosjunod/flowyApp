export type ItemType =
  | 'url'
  | 'screenshot'
  | 'youtube'
  | 'video'
  | 'receipt'
  | 'pdf'
  | 'audio'
  | 'reddit'
  | 'instagram'
  | 'screen_recording'
  | 'pinterest'
  | 'dribbble'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'facebook'
  | 'drive'
  | 'file'
  | 'email';

export type ItemStatus = 'pending' | 'processing' | 'ready' | 'error';

export type MediaSlide = {
  index: number;
  kind: 'image' | 'video';
  r2_key: string;
  source_url?: string;
  summary?: string;
  extracted_text?: string;
  transcript?: string;
  taken_at?: string;
};

export type ItemSource = 'bookmark_import' | 'reddit' | 'share_extension' | string;

export type ExplorationStatus = 'exploring' | 'enriched' | 'no_match' | 'error';
export type ExplorationLinkKind = 'github' | 'product' | 'docs' | 'app_store' | 'other';

export type ExplorationLink = {
  url: string;
  title: string;
  kind: ExplorationLinkKind;
  confidence: number;
};

export type ExplorationCandidate = {
  name: string;
  url?: string;
  kind: ExplorationLinkKind;
  confidence: number;
  reason: string;
};

export type ExplorationVideoInsights = {
  frames_analyzed: number;
  on_screen_text: string;
  visual_cues: string[];
};

export type ExplorationLinkExcerpt = {
  url: string;
  title: string;
  excerpt: string;
};

export type ExplorationDeepAnalysis = {
  synthesis: string;
  key_findings: string[];
  link_excerpts: ExplorationLinkExcerpt[];
  generated_at: string;
};

export type ItemExploration = {
  status: ExplorationStatus;
  primary_link?: ExplorationLink;
  candidates: ExplorationCandidate[];
  video_insights?: ExplorationVideoInsights;
  notes?: string;
  last_explored_at: string;
  error_msg?: string;
  deep_analysis?: ExplorationDeepAnalysis;
};

export type Item = {
  id: string;
  user: string;
  type: ItemType;
  raw_url?: string;
  r2_key?: string;
  title?: string;
  summary?: string;
  content?: string;
  notes?: string;
  tags: string[];
  category?: string;
  status: ItemStatus;
  error_msg?: string;
  source_url?: string;
  media?: MediaSlide[];
  source?: ItemSource;
  original_title?: string;
  bookmarked_at?: string;
  /** Server-recorded first detail opening; absence means no recorded event. */
  first_opened_at?: string;
  /** Explicit manual completion only; empty/absent means unmarked. */
  read_at?: string;
  import_batch?: string;
  /** OpenGraph fields surfaced by ingest enrichment (read by detail renderers). */
  og_image?: string;
  og_description?: string;
  site_name?: string;
  /**
   * Type-specific structured payload written by the worker (e.g. `ReceiptData`
   * when `type === 'receipt'`). Stored as JSON in PocketBase. Renderers narrow
   * via `type` before reading.
   */
  structured_content?: import('./semantic').SemanticContentV1 | import('./receipt').ReceiptData | Record<string, unknown>;
  /** R2 URLs of the original uploaded media (e.g. the receipt photo). */
  original_media_urls?: string[];
  /**
   * Result of the exploration/enrichment pass. Items now arrive auto-enriched at
   * ingest with `primary_link` + `candidates`; the deep-dive pass populates
   * `deep_analysis` with synthesis + key findings + link excerpts.
   */
  exploration?: ItemExploration;
  created: string;
  updated: string;
};

export * from './receipt';

/**
 * Rich item reference carried by chat's `x-items` response header. The web
 * names this `ChatItemRef`; mobile keeps the existing `CitedItem` symbol for
 * compat. Extended fields (og_image / raw_url / site_name / status) power
 * citation thumbnails + the "might be related" fallback rail.
 */
export type CitedItem = {
  id: string;
  type: ItemType;
  title?: string;
  category?: string;
  source_url?: string;
  raw_url?: string;
  r2_key?: string;
  og_image?: string;
  site_name?: string;
  status?: ItemStatus;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  sequence?: number;
  historyStatus?: import('../lib/chatContract').HistoryStatus;
  id: string;
  role: ChatRole;
  content: string;
  citations?: CitedItem[];
  streaming?: boolean;
  interrupted?: boolean;
  error?: string;
};

export type ApiErrorCode =
  | 'AI_PROCESSING_CONSENT_REQUIRED'
  | 'INVALID_PERSONALIZATION'
  | 'BODY_TOO_LARGE'
  | 'INVALID_BODY'
  | 'PERSONALIZATION_CONFLICT'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CHAT_HISTORY_UNAVAILABLE'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_ORIGIN'
  | 'INVALID_ENGAGEMENT'
  | 'ENGAGEMENT_UNAVAILABLE'
  | 'INGEST_FAILED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  /** DELETE /api/account — the typed confirmation phrase did not match. */
  | 'CONFIRMATION_MISMATCH'
  | 'UNKNOWN';

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  status?: number;
};

export type ApiResult<T> = { data: T; error: null } | { data: null; error: ApiError };

export type SortField = 'created' | 'category' | 'type';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list' | 'detail';

export type IngestType =
  | 'url'
  | 'screenshot'
  | 'youtube'
  | 'video'
  | 'screen_recording'
  | 'reddit'
  | 'instagram'
  | 'pinterest'
  | 'dribbble'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'facebook'
  | 'pdf'
  | 'file';

export type SharedFile = {
  name: string;
  mime: string;
  data: string;
};

export type IngestPayload = {
  type: IngestType;
  raw_url?: string;
  raw_image?: string;
  raw_images?: string[];
  raw_video?: string;
  video_mime?: string;
  raw_pdf?: SharedFile;
  raw_pdfs?: SharedFile[];
  raw_file?: SharedFile;
  raw_files?: SharedFile[];
};

export type IngestResponse = { id: string; status: ItemStatus };

export type IngestBulkPayload = {
  urls: string[];
  dedupeAgainst?: string[];
};

export type IngestBulkResponse = {
  batch_id: string;
  total: number;
};

export type ImportBatchStatus = 'processing' | 'done';

export type ImportBatch = {
  id: string;
  status: ImportBatchStatus;
  processed: number;
  dead_count: number;
  total: number;
};

export type AuthSession = {
  token: string;
  userId: string;
  email: string;
};

export type AliasData = {
  alias: string;
  email: string;
  domain: string;
};

export type DigestCadence = 'daily' | 'weekly' | 'monthly';

export type DigestSection = {
  category: string;
  summary: string;
  image_urls: string[];
  item_ids: string[];
};

export type DigestBlock = { id: string; text: string; source_item_ids: string[] };

export type DigestContent = {
  version?: 2;
  title?: string;
  tldr?: { bullets: DigestBlock[] };
  ideas?: DigestBlock[];
  themes?: DigestBlock[];
  highlights?: DigestBlock[];
  connections?: DigestBlock[];
  cadence?: DigestCadence;
  timezone?: string;
  quality_mode?: 'ai' | 'fallback';
  quality_reason?: string;
  selection?: {total:number;pending:number;selected:number;carryover_item_ids:string[]};
  sections: DigestSection[];
  window_start: string;
  window_end: string;
};

export type Digest = {
  cadence?: DigestCadence; first_opened_at?: string; status?: string;
  feedback?: {target:string;value:string}[];
  sources?: {id:string;title?:string;source_url?:string;raw_url?:string}[];
  id: string;
  user: string;
  generated_at: string;
  content: DigestContent;
  items_count: number;
  categories_count: number;
  created: string;
  updated: string;
};

export type DigestPreferences = {
  timezone: string; locale: 'en' | 'es';
  daily_enabled: boolean; daily_local_time: string; daily_push_enabled: boolean; daily_email_enabled: boolean;
  weekly_enabled: boolean; weekly_day: number; weekly_local_time: string; weekly_push_enabled: boolean; weekly_email_enabled: boolean;
  /** Omitted by older servers; monthly remains opt-in and shares the paid cadence gate. */
  monthly_enabled?: boolean; monthly_day?: number; monthly_local_time?: string; monthly_push_enabled?: boolean; monthly_email_enabled?: boolean;
  paused_until: string | null; excluded_types: string[]; excluded_categories: string[];
};

export type DigestSettings = {
  version?: 2; revision?: number; settings?: DigestPreferences;
  canEnableDaily?: boolean; effectivePlan?: string; quotaResetsAt?: string;
  betaAccessEndsAt?: string;
  monthlyReportQuota?: { used: number; reserved: number; remaining: number; limit: number; window: 'calendar_month_utc'; startsAt: string; resetsAt: string };
  capabilities?: { enabled: boolean; push: boolean; email: boolean };
  emailAddress?:string; emailSuppressed?:boolean; reportQuota?:{used:number;limit:number;window:string};
  emailVerified?: boolean; hasPushDevice?: boolean;
  next?: { cadence: string; enabled: boolean; next_run_at: string }[];

};

export type BulkActionFailure = {
  id: string;
  code: string;
  message?: string;
};

export type BulkActionResult = {
  succeeded: string[];
  failed: BulkActionFailure[];
};

export type BulkActionPayload = { ids: string[] };

export type DigestChatContext = {digestId: string; scope: "digest" | "items"; itemIds?: string[]; selectedText?: string};

export * from './personalization';

export type ItemEngagementAction = 'open' | 'mark_read' | 'mark_unread';
export type ItemEngagement = { id: string; first_opened_at: string; read_at: string };
