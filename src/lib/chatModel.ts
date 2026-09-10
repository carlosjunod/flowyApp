import type { ChatMessage, DigestChatContext } from '../types';

export type Conversation = {
  recovery?: {requestId: string; content: string; status: 'stopped' | 'interrupted'};
  revision?: number;
  messageCount?: number;
  before?: number | null;
  loaded?: boolean;
  pending?: boolean;
  deleting?: boolean;
  digestContext?: DigestChatContext;
  id: string;
  title: string;
  updated: number;
  draft: string;
  messages: ChatMessage[];
};
export type ChatSnapshot = { activeId: string; conversations: Conversation[] };
export const chatId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const newConversation = (): Conversation => ({ id: chatId(), title: 'New conversation', updated: Date.now(), draft: '', messages: [] });
export const emptyChat = (): ChatSnapshot => {
  const conversation = newConversation();
  return { activeId: conversation.id, conversations: [conversation] };
};

/** Local data is untrusted too. Interrupted messages stay visible and retryable. */
export function restoreChat(value: unknown): ChatSnapshot {
  if (!value || typeof value !== 'object') return emptyChat();
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.conversations)) return emptyChat();
  const conversations: Conversation[] = [];
  const ids = new Set<string>();
  for (const candidate of raw.conversations) {
    if (!candidate || typeof candidate !== 'object') continue;
    const c = candidate as Record<string, unknown>;
    if (typeof c.id !== 'string' || ids.has(c.id) || !Array.isArray(c.messages)) continue;
    ids.add(c.id);
    const messages: ChatMessage[] = [];
    for (const candidateMessage of c.messages) {
      if (!candidateMessage || typeof candidateMessage !== 'object') continue;
      const m = candidateMessage as Record<string, unknown>;
      if (typeof m.id !== 'string' || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
      messages.push({ sequence: typeof m.sequence === 'number' ? m.sequence : undefined, historyStatus: ['preparing','streaming','complete','stopped','error','interrupted'].includes(String(m.historyStatus)) ? m.historyStatus as ChatMessage['historyStatus'] : undefined, id: m.id, role: m.role, content: m.content,
        streaming: false,
        interrupted: m.streaming === true || m.interrupted === true,
        error: typeof m.error === 'string' ? m.error : undefined,
        citations: Array.isArray(m.citations) ? m.citations.filter((x): x is NonNullable<ChatMessage['citations']>[number] => {
          if (!x || typeof x !== 'object') return false;
          const ref = x as Record<string, unknown>;
          return typeof ref.id === 'string' && typeof ref.type === 'string' && ['title', 'source_url', 'raw_url', 'r2_key', 'og_image', 'site_name', 'category'].every(key => ref[key] === undefined || typeof ref[key] === 'string');
        }) : [],
      });
    }
    const ctx = c.digestContext as Partial<DigestChatContext> | undefined;
    const digestContext: DigestChatContext | undefined = ctx && typeof ctx.digestId === 'string' && /^[a-z0-9]{15}$/.test(ctx.digestId) && (ctx.scope === 'digest' || ctx.scope === 'items') && (ctx.itemIds === undefined || (Array.isArray(ctx.itemIds) && ctx.itemIds.length <= 50 && ctx.itemIds.every(id => typeof id === 'string' && /^[a-z0-9]{15}$/.test(id)))) ? ctx as DigestChatContext : undefined;
    const rec=c.recovery as Partial<NonNullable<Conversation['recovery']>> | undefined;
    const recovery=rec && typeof rec.requestId==='string' && typeof rec.content==='string' && (rec.status==='stopped' || rec.status==='interrupted') ? rec as Conversation['recovery'] : undefined;
    conversations.push({ recovery, revision: typeof c.revision === 'number' ? c.revision : undefined, messageCount: typeof c.messageCount === 'number' ? c.messageCount : undefined, before: typeof c.before === 'number' ? c.before : null, loaded: false, pending: false, deleting: c.deleting === true, digestContext, id: c.id, title: typeof c.title === 'string' ? c.title : 'Conversation', updated: typeof c.updated === 'number' ? c.updated : Date.now(), draft: typeof c.draft === 'string' ? c.draft : '', messages });
  }
  if (!conversations.length) return emptyChat();
  return { activeId: typeof raw.activeId === 'string' && ids.has(raw.activeId) ? raw.activeId : conversations[0]!.id, conversations };
}

export function retryTurn(messages: ChatMessage[]): { history: ChatMessage[]; question: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return { history: messages.slice(0, i), question: messages[i]!.content };
  }
  return null;
}
