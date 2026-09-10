import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { nativeChatAdapters, nativeConversation } from '@/lib/chatSync';
import { useChatEngine } from './useChatEngine';
export function useChatState(accountId: string) {
  const engine = useChatEngine(accountId, nativeChatAdapters),
    ref = useRef(engine);
  ref.current = engine;
  const [unread, setUnread] = useState(false),
    visible = useRef(false),
    previousRun = useRef<string | null>(null);
  useEffect(() => {
    if (
      previousRun.current &&
      !engine.generatingId &&
      (!visible.current || engine.active.id !== previousRun.current)
    )
      setUnread(true);
    previousRun.current = engine.generatingId;
  }, [engine.generatingId]);
  useEffect(() => {
    setUnread(false);
  }, [accountId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      void ref.current.persist();
      if (next === 'active') void ref.current.refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void ref.current.refresh();
    }, 15000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  const active = nativeConversation(engine.active);
  return {
    ...engine,
    active,
    snapshot: {
      activeId: engine.history.activeId,
      conversations: engine.history.conversations
        .filter((c) => !c.deleting)
        .map(nativeConversation),
    },
    storageError: engine.storageError || engine.syncError,
    unread,
    messages: active.messages,
    draft: active.draft,
    pending: engine.generatingId === active.id || active.pending === true,
    setVisible: (value: boolean) => {
      visible.current = value;
      if (value) {
        setUnread(false);
        void ref.current.refresh();
      }
    },
    select: engine.open,
    reset: () => engine.startNew(),
    startDigest: (digestId: string, itemIds?: string[]) =>
      engine.startNew({
        digestId,
        itemIds,
        scope: itemIds ? 'items' : 'digest',
      }),
  };
}
type ChatApi = ReturnType<typeof useChatState>;
const ChatContext = createContext<ChatApi | null>(null);
export function ChatProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const value = useChatState(accountId);
  return React.createElement(ChatContext.Provider, { value }, children);
}
export function useChat(): ChatApi {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat requires ChatProvider');
  return value;
}
