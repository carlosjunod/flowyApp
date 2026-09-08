import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { chatStream } from '@/lib/api';
import { chatStorage } from '@/lib/chatStorage';
import { chatId, emptyChat, newConversation, restoreChat, retryTurn, type ChatSnapshot, type Conversation } from '@/lib/chatModel';
import type { ChatMessage } from '@/types';

export function useChatState(accountId: string) {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(emptyChat);
  const state = useRef(snapshot);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const live = useRef(true);
  const hydrated = useRef(false);
  const loadVersion = useRef(0);
  const generation = useRef<{ id: string; conversationId: string; assistantId: string; controller: AbortController } | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const visible = useRef(false);
  const change = (update: (current: ChatSnapshot) => ChatSnapshot) => {
    if (!live.current) return;
    state.current = update(state.current);
    setSnapshot(state.current);
  };
  const persist = (value = state.current) => chatStorage.write(accountId, value).then(() => {
    if (live.current) setStorageError(null);
  }).catch(() => {
    if (live.current) setStorageError('Chat could not be saved on this device. Your current conversation is still available.');
  });

  const hydrate = () => {
    const version = ++loadVersion.current;
    void chatStorage.read(accountId).then(value => {
      if (!live.current || version !== loadVersion.current) return;
      change(() => restoreChat(value));
      hydrated.current = true;
      setStorageError(null);
      setReady(true);
    }).catch(() => {
      if (live.current && version === loadVersion.current) setStorageError('Saved chats could not be loaded. Retry to protect your existing conversations.');
    });
  };
  useEffect(() => {
    live.current = true;
    hydrate();
    return () => {
      live.current = false;
      loadVersion.current++;
      generation.current?.controller.abort();
      generation.current = null;
      if (hydrated.current) void chatStorage.write(accountId, state.current).catch(() => {});
    };
  }, [accountId]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { void persist(snapshot); }, 650);
    return () => clearTimeout(timer);
  }, [snapshot, ready]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => { if (next !== 'active' && ready) void persist(); });
    return () => sub.remove();
  }, [ready]);

  const stop = () => {
    const run = generation.current;
    if (!run) return;
    generation.current = null; // stale tokens/finalizers cannot touch a newer run
    run.controller.abort();
    setGeneratingId(null);
    change(current => ({ ...current, conversations: current.conversations.map(c => c.id !== run.conversationId ? c : { ...c, messages: c.messages.map(m => m.id !== run.assistantId ? m : { ...m, streaming: false, interrupted: true }) }) }));
    void persist();
  };

  const send = async (text: string, priorMessages?: ChatMessage[]) => {
    const trimmed = text.trim();
    if (!ready || !trimmed || generation.current) return;
    const conversationId = state.current.activeId;
    const conversation = state.current.conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    const history = priorMessages ?? conversation.messages;
    const assistantId = chatId();
    const run = { id: chatId(), conversationId, assistantId, controller: new AbortController() };
    generation.current = run;
    setGeneratingId(conversationId);
    change(current => ({ ...current, conversations: current.conversations.map(c => c.id !== conversationId ? c : {
      ...c, updated: Date.now(), title: history.length === 0 ? trimmed.slice(0, 70) : c.title, draft: '',
      messages: [...history, { id: chatId(), role: 'user', content: trimmed }, { id: assistantId, role: 'assistant', content: '', streaming: true }],
    }) }));
    void persist();
    const updateMessage = (update: (m: ChatMessage) => ChatMessage) => {
      if (!live.current || generation.current !== run) return;
      change(current => ({ ...current, conversations: current.conversations.map(c => c.id !== conversationId ? c : { ...c, messages: c.messages.map(m => m.id === assistantId ? update(m) : m) }) }));
    };
    try {
      const context = history.filter(m => !m.error && !m.interrupted && !!m.content).map(m => ({ role: m.role, content: m.content }));
      for await (const event of chatStream(trimmed, context, run.controller.signal, conversation.digestContext)) {
        if (generation.current !== run || !live.current) break;
        if (event.type === 'token') updateMessage(m => ({ ...m, content: m.content + event.value }));
        else if (event.type === 'sources') updateMessage(m => ({ ...m, citations: event.citations }));
        else if (event.type === 'done') updateMessage(m => ({ ...m, streaming: false, citations: event.citations, error: m.content.trim() ? m.error : 'No response was received. Please retry.' }));
        else updateMessage(m => ({ ...m, streaming: false, error: 'The response could not be completed. Check your connection and retry.' }));
      }
    } catch {
      updateMessage(m => ({ ...m, streaming: false, error: 'The connection was interrupted. You can retry this response.' }));
    } finally {
      if (generation.current === run && live.current) {
        updateMessage(m => ({ ...m, streaming: false }));
        generation.current = null;
        setGeneratingId(null);
        if (!visible.current || state.current.activeId !== conversationId) setUnread(true);
        void persist();
      }
    }
  };
  const active = snapshot.conversations.find(c => c.id === snapshot.activeId) ?? snapshot.conversations[0]!;
  return {
    ready, storageError, unread, generatingId, snapshot, active,
    messages: active.messages, draft: active.draft,
    pending: generatingId === active.id,
    setVisible: (value: boolean) => { visible.current = value; if (value) setUnread(false); },
    setDraft: (draft: string) => { if (!ready) return; change(current => ({ ...current, conversations: current.conversations.map(c => c.id === current.activeId ? { ...c, draft } : c) })); },
    send: (text: string) => send(text), stop,
    retry: () => { const turn = retryTurn(state.current.conversations.find(c => c.id === state.current.activeId)?.messages ?? []); if (turn) void send(turn.question, turn.history); },
    select: (id: string) => change(current => current.conversations.some(c => c.id === id) ? { ...current, activeId: id } : current),
    startDigest: (digestId: string, itemIds?: string[]) => {
      if (!ready) return;
      stop();
      const conversation: Conversation = {...newConversation(), title: 'About your digest', draft: itemIds ? 'Help me understand this source.' : 'What should I remember from this digest?', digestContext: {digestId, itemIds, scope: itemIds ? 'items' : 'digest'}};
      change(current => ({...current, activeId: conversation.id, conversations: [conversation, ...current.conversations]}));
      void persist();
    },
    reset: () => {
      if (!ready) return;
      stop();
      const conversation = newConversation();
      change(current => ({ activeId: conversation.id, conversations: [conversation, ...current.conversations.filter(c => c.messages.length || c.draft)] }));
      void persist();
    },
    deleteConversation: (id: string) => {
      if (!ready) return;
      if (generation.current?.conversationId === id) stop();
      change(current => {
        const conversations = current.conversations.filter(c => c.id !== id);
        if (!conversations.length) return emptyChat();
        return { activeId: current.activeId === id ? conversations[0]!.id : current.activeId, conversations };
      });
      void persist();
    },
    removeAccountHistory: async () => {
      stop();
      hydrated.current = false;
      setReady(false);
      change(() => emptyChat());
      await chatStorage.remove(accountId);
    },
    retryStorage: () => { if (ready) void persist(); else hydrate(); },
  };
}

type ChatApi = ReturnType<typeof useChatState>;
const ChatContext = createContext<ChatApi | null>(null);
export function ChatProvider({ accountId, children }: { accountId: string; children: React.ReactNode }) {
  const value = useChatState(accountId);
  return React.createElement(ChatContext.Provider, { value }, children);
}
export const useChat = (): ChatApi => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat requires ChatProvider');
  return context;
};
