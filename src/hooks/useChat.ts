import { useCallback, useRef, useState } from 'react';

import { chatStream } from '@/lib/api';
import type { ChatMessage } from '@/types';

const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

type UseChatReturn = {
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  reset: () => void;
};

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setPending(false);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setError(null);
      const userMsg: ChatMessage = {
        id: randomId(),
        role: 'user',
        content: trimmed,
      };
      const assistantId = randomId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        citations: [],
      };
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const evt of chatStream(trimmed, history, controller.signal)) {
          if (evt.type === 'token') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + evt.value } : m,
              ),
            );
          } else if (evt.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, streaming: false, citations: evt.citations }
                  : m,
              ),
            );
          } else {
            setError(evt.error.message);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, streaming: false, content: m.content || '(error)' }
                  : m,
              ),
            );
          }
        }
      } finally {
        setPending(false);
        abortRef.current = null;
      }
    },
    [messages, pending],
  );

  return { messages, pending, error, send, reset };
};
