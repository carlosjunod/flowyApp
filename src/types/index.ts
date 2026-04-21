export type ItemType =
  | 'url'
  | 'screenshot'
  | 'youtube'
  | 'video'
  | 'receipt'
  | 'pdf'
  | 'audio';

export type ItemStatus = 'pending' | 'processing' | 'ready' | 'error';

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

export type IngestType = 'url' | 'screenshot' | 'youtube' | 'video';
export type IngestPayload = {
  type: IngestType;
  raw_url?: string;
  raw_image?: string;
};

export type IngestResponse = { id: string; status: ItemStatus };
