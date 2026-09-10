// Portable wire contract; mirrored in flowyApp/src/lib/chatContract.ts.
export type HistoryStatus =
  'preparing' | 'streaming' | 'complete' | 'stopped' | 'error' | 'interrupted';
export type HistoryItem = {
  id: string;
  type: string;
  title?: string | null;
  category?: string | null;
  source_url: string | null;
  raw_url?: string | null;
  r2_key?: string | null;
  og_image?: string | null;
  site_name?: string | null;
  media?: { r2_key?: string }[] | null;
};
export type HistoryDigest = {
  digestId: string;
  scope: 'digest' | 'items';
  itemIds?: string[];
};
export type HistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: HistoryStatus;
  items?: HistoryItem[];
  sequence?: number;
};
export type HistoryConversation = {
  id: string;
  title: string;
  updatedAt: number;
  revision: number;
  messageCount: number;
  deleted: boolean;
  pending: boolean;
  activeRequestId?: string;
  digestContext?: HistoryDigest;
};
export type HistoryPage = {
  conversation: HistoryConversation;
  messages: HistoryMessage[];
  before: number | null;
};
export type HistoryList = {
  conversations: HistoryConversation[];
  next: string | null;
};
export type HistoryImport = {
  id: string;
  title: string;
  updatedAt: number;
  digestContext?: HistoryDigest;
  messages: HistoryMessage[];
};
export type HistoryOperation =
  | { op: 'list'; after?: string }
  | { op: 'get'; id: string; before?: number }
  | { op: 'import'; conversation: HistoryImport }
  | { op: 'delete'; id: string }
  | {
      op: 'stop';
      id: string;
      requestId: string;
      content?: string;
      status?: 'stopped' | 'interrupted';
    };
export type ChatTurn = {
  conversationId: string;
  revision: number;
  requestId: string;
  userMessageId: string;
};
