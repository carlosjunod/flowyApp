import { chatHistoryRequest, chatStream } from './api';
import { chatStorage } from './chatStorage';
import { restoreChat, type ChatSnapshot, type Conversation } from './chatModel';
import type {
  ChatAdapters,
  LocalHistory,
  LocalConversation,
} from '../hooks/useChatEngine';
import type { ChatTurn, HistoryMessage, HistoryDigest } from './chatContract';
import type { ChatMessage, CitedItem } from '../types';
export function toHistory(snapshot: ChatSnapshot): LocalHistory {
  return {
    ...snapshot,
    conversations: snapshot.conversations.map((c) => ({
      ...c,
      updatedAt: c.updated,
      messages: c.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sequence: m.sequence,
        status:
          m.streaming || m.interrupted
            ? 'interrupted'
            : m.historyStatus || (m.error ? 'error' : 'complete'),
        items: (m.citations || []).map((i) => ({
          ...i,
          source_url: i.source_url || null,
        })),
      })),
    })),
  };
}
export function nativeMessage(m: HistoryMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    sequence: m.sequence,
    historyStatus: m.status,
    streaming: m.status === 'preparing' || m.status === 'streaming',
    interrupted: m.status === 'interrupted' || m.status === 'stopped',
    error:
      m.status === 'error'
        ? 'This response could not be completed. Please try again.'
        : undefined,
    citations: (m.items || []).map((i) => ({
      id: i.id,
      type: i.type as CitedItem['type'],
      title: i.title || undefined,
      category: i.category || undefined,
      source_url: i.source_url || undefined,
      raw_url: i.raw_url || undefined,
      r2_key: i.r2_key || undefined,
      og_image: i.og_image || undefined,
      site_name: i.site_name || undefined,
    })),
  };
}
export function nativeConversation(c: LocalConversation): Conversation {
  return {
    ...c,
    updated: c.updatedAt,
    messages: c.messages.map(nativeMessage),
  };
}
export const nativeChatAdapters: ChatAdapters = {
  read: async (user) => toHistory(restoreChat(await chatStorage.read(user))),
  write: async (user, h) =>
    chatStorage.write(user, {
      activeId: h.activeId,
      conversations: h.conversations.map(nativeConversation),
    }),
  remove: async (user) => chatStorage.remove(user),
  request: async <T>(
    op: Parameters<ChatAdapters['request']>[0],
    signal: AbortSignal,
  ): Promise<T> => {
    const result = await chatHistoryRequest<T>(op, signal);
    if (result.error) throw new Error(result.error.code);
    return result.data;
  },
  stream: async (text, turn, signal, patch, digestContext) => {
    await streamResponse(text, [], digestContext, turn, signal, patch);
  },
  streamLocal: async (text, conversation, signal, patch) => {
    const history = conversation.messages
      .filter((m) => m.content.trim() && (!m.status || m.status === 'complete'))
      .slice(-20)
      .map(({ role, content }) => ({ role, content: content.slice(0, 16000) }));
    await streamResponse(text, history, conversation.digestContext, undefined, signal, patch);
  },
};

async function streamResponse(
  text: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  digestContext: HistoryDigest | undefined,
  turn: ChatTurn | undefined,
  signal: AbortSignal,
  patch: (change: Partial<HistoryMessage>) => void,
) {
    let content = '';
    for await (const event of chatStream(text, history, signal, digestContext, turn)) {
      if (event.type === 'error') throw new Error(event.error.code);
      if (event.type === 'sources')
        patch({
          status: 'streaming',
          items: event.citations.map((i) => ({
            ...i,
            source_url: i.source_url || null,
          })),
        });
      if (event.type === 'token') {
        content += event.value;
        patch({ content, status: 'streaming' });
      }
      if (event.type === 'done')
        patch({ content, status: content.trim() ? 'complete' : 'error' });
    }
}
