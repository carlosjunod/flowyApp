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
  tags: string[];
  category?: string;
  status: ItemStatus;
  error_msg?: string;
  source_url?: string;
  media?: MediaSlide[];
  source?: ItemSource;
  original_title?: string;
  bookmarked_at?: string;
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
  structured_content?: unknown;
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
  id: string;
  role: ChatRole;
  content: string;
  citations?: CitedItem[];
  streaming?: boolean;
};

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_INPUT'
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

export type IngestType = 'url' | 'screenshot' | 'youtube' | 'video' | 'screen_recording';
export type IngestPayload = {
  type: IngestType;
  raw_url?: string;
  raw_image?: string;
  raw_images?: string[];
  raw_video?: string;
  video_mime?: string;
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

export type DigestSection = {
  category: string;
  summary: string;
  image_urls: string[];
  item_ids: string[];
};

export type DigestContent = {
  sections: DigestSection[];
  window_start: string;
  window_end: string;
};

export type Digest = {
  id: string;
  user: string;
  generated_at: string;
  content: DigestContent;
  items_count: number;
  categories_count: number;
  created: string;
  updated: string;
};

export type DigestSettings = {
  digest_enabled: boolean;
  digest_time: string;
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

// ---- Billing ----
// Mirrors the server contract in the Flowy web repo (`apps/web/types/billing.ts`).
// Keep the two in step: this is a hand-copied contract, not a shared package.

export type PlanId = 'free' | 'starter' | 'plus' | 'pro';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingInterval = 'month' | 'year';

/** Which processor the active subscription is billed through. */
export type SubscriptionSource = 'stripe' | 'apple';

export type SubscriptionStatus =
  | 'none'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export type PlanLimits = {
  savesPerMonth: number | 'unlimited';
  aiActionsPerMonth: number | 'unlimited';
  deepDivesPerMonth: number | 'unlimited';
  dailyDigest: boolean;
  emailIn: boolean;
  priorityProcessing: boolean;
  chatHistoryDays: number | 'unlimited';
};

export type SubscriptionView = {
  /** Effective plan — falls back to 'free' when the status is not entitled. */
  plan: PlanId;
  /** 'none' when the user has no subscriptions row. */
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  /** ISO 8601 */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** ISO 8601 */
  trialEnd: string | null;
  hasBillingAccount: boolean;
  isPaid: boolean;
  trialEligible: boolean;
  limits: PlanLimits;
  /**
   * OPTIONAL, not nullable-only: the server began reporting `source` with
   * dual-source (Stripe + Apple) entitlements. A build talking to a server
   * that predates that sees the field absent, so treat `undefined` as
   * "unknown", never as "not Apple".
   */
  source?: SubscriptionSource | null;
};
