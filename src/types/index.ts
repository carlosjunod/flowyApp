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
  | 'screen_recording';

export type ItemStatus = 'pending' | 'processing' | 'ready' | 'error';

export type MediaSlide = {
  index: number;
  kind: 'image' | 'video';
  r2_key: string;
  source_url?: string;
  summary?: string;
  extracted_text?: string;
};

export type ItemSource = 'bookmark_import' | 'reddit' | 'share_extension' | string;

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
  created: string;
  updated: string;
};

export type CitedItem = {
  id: string;
  type: ItemType;
  title?: string;
  category?: string;
  source_url?: string;
  r2_key?: string;
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
