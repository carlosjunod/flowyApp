// Shared with the Expo client. Platform adapters own transport and local storage.
import { useEffect, useRef, useState } from 'react';
import type {
  ChatTurn,
  HistoryConversation,
  HistoryImport,
  HistoryDigest,
  HistoryList,
  HistoryMessage,
  HistoryOperation,
  HistoryPage,
} from '../lib/chatContract';
export type LocalConversation = HistoryImport & {
  draft: string;
  activeRequestId?: string;
  recovery?: {
    requestId: string;
    content: string;
    status: 'stopped' | 'interrupted';
  };
  revision?: number;
  messageCount?: number;
  before?: number | null;
  loaded?: boolean;
  pending?: boolean;
  deleting?: boolean;
};
export type LocalHistory = {
  activeId: string;
  conversations: LocalConversation[];
};
export type ChatAdapters = {
  read: (user: string) => Promise<LocalHistory>;
  write: (user: string, history: LocalHistory) => Promise<void>;
  remove: (user: string) => Promise<void>;
  streamLocal?: (
    text: string,
    conversation: LocalConversation,
    signal: AbortSignal,
    patch: (change: Partial<HistoryMessage>) => void,
  ) => Promise<void>;
  request: <T>(op: HistoryOperation, signal: AbortSignal) => Promise<T>;
  stream: (
    text: string,
    turn: ChatTurn,
    signal: AbortSignal,
    patch: (change: Partial<HistoryMessage>) => void,
    digestContext?: HistoryDigest,
  ) => Promise<void>;
};
export const newChatId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

/**
 * Sentinel title for a conversation the user has not named by asking anything.
 *
 * Deliberately stored in English: it is persisted and synced across devices, so
 * translating it at creation time would write the creating device's language
 * into shared data. The UI compares against this constant and renders
 * `chat.history.newConversation` instead — see `ChatPanel`.
 */
export const DEFAULT_CONVERSATION_TITLE = 'New conversation';

/** Title + prefilled drafts for a digest-scoped conversation. */
export interface DigestSeedCopy {
  title: string;
  sourceDraft: string;
  digestDraft: string;
}

export const DEFAULT_DIGEST_SEED: DigestSeedCopy = {
  title: 'About your digest',
  sourceDraft: 'Help me understand this source.',
  digestDraft: 'What should I remember from this digest?',
};

export const freshConversation = (): LocalConversation => ({
  id: newChatId(),
  title: DEFAULT_CONVERSATION_TITLE,
  updatedAt: Date.now(),
  draft: '',
  messages: [],
});
export function freshHistory(): LocalHistory {
  const c = freshConversation();
  return { activeId: c.id, conversations: [c] };
}
/**
 * Maps a thrown error's *code* to a translation key.
 *
 * The engine is shared with the web client, which has its own dictionary, so it
 * returns keys rather than sentences. Every key below exists under
 * `chat.errors.*` in both dictionaries.
 */
export function chatErrorKey(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'CHAT_BUSY') return 'chat.errors.CHAT_BUSY';
  if (code === 'REVISION_CONFLICT') return 'chat.errors.REVISION_CONFLICT';
  if (code === 'REQUEST_EXISTS') return 'chat.errors.REQUEST_EXISTS';
  if (code === 'CHAT_DELETED') return 'chat.errors.CHAT_DELETED';
  if (code === 'NOT_FOUND') return 'chat.errors.NOT_FOUND';
  if (code === 'CHAT_HISTORY_UNAVAILABLE') return 'chat.errors.CHAT_HISTORY_UNAVAILABLE';
  if (code === 'CHAT_TIMEOUT') return 'chat.errors.CHAT_TIMEOUT';
  if (code === 'UNAUTHORIZED') return 'chat.errors.UNAUTHORIZED';
  if (code === 'BODY_TOO_LARGE' || code === 'VALIDATION_FAILED')
    return 'chat.errors.BODY_TOO_LARGE';
  return 'chat.errors.DEFAULT';
}
export function useChatEngine(
  accountId: string | null,
  adapters: ChatAdapters,
) {
  const [history, setHistory] = useState<LocalHistory>(freshHistory),
    state = useRef(history);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState<string | null>(null),
    [syncError, setSyncError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false),
    [synced, setSynced] = useState(false),
    [generatingId, setGeneratingId] = useState<string | null>(null);
  const latest = useRef(adapters);
  latest.current = adapters;
  type Session = {
    user: string;
    controller: AbortController;
    writable: boolean;
    unavailable?: boolean;
    refresh?: Promise<void>;
  };
  type Run = {
    session: Session;
    id: string;
    requestId: string;
    controller: AbortController;
    started: boolean;
    accepted: boolean;
    local?: boolean;
  };
  const session = useRef<Session | null>(null),
    run = useRef<Run | null>(null);
  const valid = (s: Session) =>
    session.current === s && !s.controller.signal.aborted;
  const change = (fn: (h: LocalHistory) => LocalHistory) => {
    state.current = fn(state.current);
    setHistory(state.current);
  };
  const persist = async (s = session.current) => {
    if (!s || !valid(s) || !s.writable) return;
    try {
      // Bound synced caches, while preserving every not-yet-imported local message.
      const h = state.current;
      const cache = {
        ...h,
        conversations: h.conversations.map((c) => {
          if (c.revision === undefined || c.messages.length <= 50) return c;
          const messages = c.messages.slice(-50);
          return { ...c, messages, before: messages[0]?.sequence || c.before };
        }),
      };
      await latest.current.write(s.user, cache);
      if (valid(s)) setStorageError(null);
    } catch {
      if (valid(s)) setStorageError('chat.errors.storageWrite');
    }
  };
  const request = <T>(
    s: Session,
    op: HistoryOperation,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (!valid(s)) return Promise.reject(new Error('SESSION_CHANGED'));
    const controller = new AbortController();
    return new Promise<T>((resolve, reject) => {
      const cancel = () => {
        controller.abort();
        reject(new Error('CANCELLED'));
      };
      const timer = setTimeout(() => {
        controller.abort();
        reject(new Error('CHAT_TIMEOUT'));
      }, 15000);
      const cleanup = () => {
        clearTimeout(timer);
        s.controller.signal.removeEventListener('abort', cancel);
        signal?.removeEventListener('abort', cancel);
      };
      s.controller.signal.addEventListener('abort', cancel, { once: true });
      signal?.addEventListener('abort', cancel, { once: true });
      if (s.controller.signal.aborted || signal?.aborted) cancel();
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted) throw new Error('CANCELLED');
          return latest.current.request<T>(op, controller.signal);
        })
        .then(resolve, reject)
        .finally(cleanup);
      controller.signal.addEventListener('abort', cleanup, { once: true });
    }).catch((error: unknown) => {
      if (
        valid(s) &&
        error instanceof Error &&
        error.message === 'CHAT_HISTORY_UNAVAILABLE'
      ) {
        s.unavailable = true;
        setLocalOnly(true);
      }
      throw error;
    });
  };
  const applyPage = (page: HistoryPage, older = false) =>
    change((h) => ({
      ...h,
      conversations: h.conversations.map((c) => {
        if (c.id !== page.conversation.id || c.deleting || c.recovery) return c;
        if (run.current?.id === c.id && run.current.started) return c;
        const messages = older
          ? [
              ...page.messages,
              ...c.messages.filter(
                (m) => !page.messages.some((p) => p.id === m.id),
              ),
            ]
          : page.messages;
        return {
          ...c,
          ...page.conversation,
          messages,
          before: page.before,
          loaded: true,
        };
      }),
    }));
  const load = async (
    s: Session,
    id: string,
    before?: number,
    signal?: AbortSignal,
  ) => {
    const page = await request<HistoryPage>(
      s,
      {
        op: 'get',
        id,
        ...(before ? { before } : {}),
      },
      signal,
    );
    if (valid(s)) {
      const local = state.current.conversations.find((c) => c.id === id);
      if (before && local?.revision !== page.conversation.revision) {
        await load(s, id, undefined, signal);
        return;
      }
      applyPage(page, Boolean(before));
    }
  };
  const refresh = async (): Promise<void> => {
    const s = session.current;
    if (!s || !s.writable || !valid(s)) return;
    // Never import an in-flight local response or reconcile over its partial text.
    if (run.current?.started && run.current.local) return;
    if (s.refresh) return s.refresh;
    const task = (async () => {
      setSyncing(true);
      let importError: string | null = null;
      const failedImports = new Set<string>();
      try {
        for (const c of state.current.conversations) {
          if (!valid(s)) return;
          if (c.recovery && !c.deleting) {
            try {
              await request(s, { op: 'stop', id: c.id, ...c.recovery });
            } catch (error) {
              if (
                !(error instanceof Error) ||
                !['CHAT_DELETED', 'NOT_FOUND'].includes(error.message)
              )
                throw error;
            }
            if (valid(s))
              change((h) => ({
                ...h,
                conversations: h.conversations.map((x) =>
                  x.id === c.id &&
                  x.recovery?.requestId === c.recovery?.requestId
                    ? { ...x, recovery: undefined, loaded: false }
                    : x,
                ),
              }));
          }
          if (c.deleting) {
            // Import an empty tombstone target if this chat never reached the server.
            await request(s, {
              op: 'import',
              conversation: {
                id: c.id,
                title: '',
                updatedAt: c.updatedAt,
                messages: [],
              },
            });
            await request(s, { op: 'delete', id: c.id });
          } else if (
            c.revision === undefined &&
            (c.messages.length || c.digestContext)
          ) {
            try {
              const imported = await request<HistoryConversation>(s, {
                op: 'import',
                conversation: {
                  id: c.id,
                  title: c.title,
                  updatedAt: c.updatedAt,
                  digestContext: c.digestContext,
                  messages: c.messages,
                },
              });
              if (valid(s))
                change((h) => ({
                  ...h,
                  conversations: h.conversations.map((x) =>
                    x.id === c.id
                      ? { ...x, revision: imported.revision, loaded: false }
                      : x,
                  ),
                }));
            } catch (error) {
              // One unsupported legacy chat must not hide the rest of the account.
              failedImports.add(c.id);
              importError = chatErrorKey(error);
            }
          }
        }
        const remote: HistoryConversation[] = [];
        let after: string | undefined;
        do {
          const page = await request<HistoryList>(s, { op: 'list', after });
          remote.push(...page.conversations);
          after = page.next || undefined;
        } while (after);
        if (!valid(s)) return;
        change((h) => {
          const mapped = new Map(h.conversations.map((c) => [c.id, c]));
          for (const c of remote) {
            const local = mapped.get(c.id);
            if (c.deleted) {
              if (run.current?.id === c.id) {
                run.current.controller.abort();
                run.current = null;
                setGeneratingId(null);
                setPreparingId(null);
              }
              mapped.delete(c.id);
              continue;
            }
            if (
              local?.deleting ||
              local?.recovery ||
              failedImports.has(c.id) ||
              (run.current?.id === c.id && run.current.started)
            )
              continue;
            mapped.set(c.id, {
              ...local,
              ...c,
              draft: local?.draft || '',
              messages: local?.messages || [],
              before: local?.before,
              loaded: local?.loaded === true && local.revision === c.revision,
            });
          }
          const conversations = [...mapped.values()];
          if (!conversations.some((c) => !c.deleting))
            conversations.unshift(freshConversation());
          return {
            conversations,
            activeId: conversations.some(
              (c) => c.id === h.activeId && !c.deleting,
            )
              ? h.activeId
              : conversations.find((c) => !c.deleting)!.id,
          };
        });
        const active = state.current.conversations.find(
          (c) => c.id === state.current.activeId,
        );
        if (
          active?.revision !== undefined &&
          !active.loaded &&
          !(run.current?.id === active.id && run.current.started)
        )
          await load(s, active.id);
        if (valid(s)) {
          s.unavailable = false;
          setLocalOnly(false);
          setSyncError(importError);
          setSynced(
            !importError &&
              !state.current.conversations.some(
                (c) => c.recovery || c.deleting,
              ),
          );
          await persist(s);
        }
      } catch (error) {
        if (valid(s)) {
          s.unavailable =
            error instanceof Error &&
            error.message === 'CHAT_HISTORY_UNAVAILABLE';
          setLocalOnly(s.unavailable);
          setSyncError(
            s.unavailable && latest.current.streamLocal
              ? null
              : chatErrorKey(error),
          );
          setSynced(false);
        }
      } finally {
        if (valid(s)) setSyncing(false);
      }
    })();
    s.refresh = task;
    await task;
    if (s.refresh === task) s.refresh = undefined;
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    setReady(false);
    setSynced(false);
    setSyncError(null);
    setActionError(null);
    setStorageError(null);
    setSyncing(false);
    setGeneratingId(null);
    setPreparingId(null);
    setLocalOnly(false);
    change(() => freshHistory());
    if (!accountId) {
      session.current = null;
      return;
    }
    const s: Session = {
      user: accountId,
      controller: new AbortController(),
      writable: false,
    };
    session.current = s;
    void latest.current
      .read(accountId)
      .then((h) => {
        if (!valid(s)) return;
        change(() => h);
        s.writable = true;
        setReady(true);
        void refreshRef.current();
      })
      .catch(() => {
        if (valid(s)) setStorageError('chat.errors.storageRead');
      });
    return () => {
      if (s.writable)
        void latest.current.write(s.user, state.current).catch(() => {});
      s.controller.abort();
      if (run.current?.session === s) {
        run.current.controller.abort();
        run.current = null;
      }
    };
  }, [accountId]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void persist();
    }, 650);
    return () => clearTimeout(t);
  }, [history, ready]);
  useEffect(() => {
    if (!ready) return;
    const c = state.current.conversations.find(
      (c) => c.id === history.activeId,
    );
    if (c?.revision !== undefined && !c.loaded) void refreshRef.current();
  }, [history.activeId, ready]);
  const stop = () => {
    const r = run.current,
      c = state.current.conversations.find(
        (c) => c.id === (r?.id || state.current.activeId),
      );
    if (!c) return;
    const requestId = r?.requestId || c.activeRequestId;
    if (!requestId) return;
    if (r) {
      run.current = null;
      r.controller.abort();
      setGeneratingId(null);
      setPreparingId(null);
    }
    // Cancelling preflight has not claimed a server turn and needs no recovery.
    if (r && !r.started) return;
    const partial = c.messages.find((m) => m.id === requestId)?.content || '';
    change((h) => ({
      ...h,
      conversations: h.conversations.map((x) =>
        x.id === c.id
          ? {
              ...x,
              pending: false,
              recovery: r?.local
                ? undefined
                : { requestId, content: partial, status: 'stopped' },
              messages: x.messages.map((m) =>
                m.id === requestId ? { ...m, status: 'stopped' } : m,
              ),
            }
          : x,
      ),
    }));
    void persist().then(() => refreshRef.current());
  };

  const send = async (text: string) => {
    const question = text.trim(),
      s = session.current,
      c = state.current.conversations.find(
        (c) => c.id === state.current.activeId,
      );
    if (
      !question ||
      !s ||
      !valid(s) ||
      !ready ||
      !c ||
      c.deleting ||
      run.current
    )
      return;
    if (question.length > 16000) {
      setSyncError('chat.errors.tooLong');
      return;
    }
    setActionError(null);
    const r: Run = {
      session: s,
      id: c.id,
      requestId: newChatId(),
      controller: new AbortController(),
      started: false,
      accepted: false,
    };
    run.current = r;
    setGeneratingId(c.id);
    setPreparingId(c.id);
    change((h) => ({
      ...h,
      conversations: h.conversations.map((x) =>
        x.id === c.id ? { ...x, draft: question } : x,
      ),
    }));
    let before: LocalConversation | undefined;
    try {
      if (s.refresh) await s.refresh;
      if (!valid(s) || run.current !== r) return;
      let current = state.current.conversations.find((x) => x.id === c.id);
      if (!current || current.deleting) throw new Error('CHAT_DELETED');
      r.local =
        s.unavailable &&
        !!latest.current.streamLocal &&
        current.revision === undefined &&
        !current.recovery;
      if (s.unavailable && !r.local)
        throw new Error('CHAT_HISTORY_UNAVAILABLE');
      if (!r.local && current.revision === undefined) {
        await request(
          s,
          {
            op: 'import',
            conversation: {
              id: current.id,
              title: current.title,
              updatedAt: current.updatedAt,
              digestContext: current.digestContext,
              messages: current.messages,
            },
          },
          r.controller.signal,
        );
        await load(s, current.id, undefined, r.controller.signal);
        current = state.current.conversations.find((x) => x.id === c.id)!;
      }
      if (!valid(s) || run.current !== r) return;
      if (current.pending) throw new Error('CHAT_BUSY');
      // A stale loaded revision is deliberately sent to the server: reject instead of answering unseen context.
      if (!r.local && !current.loaded) {
        await load(s, current.id, undefined, r.controller.signal);
        throw new Error('REVISION_CONFLICT');
      }
      before = current;
      r.started = true;
      setPreparingId(null);
      const userMessageId = newChatId();
      change((h) => ({
        ...h,
        conversations: h.conversations.map((x) =>
          x.id === c.id
            ? {
                ...x,
                draft: '',
                title: x.messages.length ? x.title : question.slice(0, 80),
                updatedAt: Date.now(),
                pending: true,
                messages: [
                  ...x.messages,
                  {
                    id: userMessageId,
                    role: 'user',
                    content: question,
                    status: 'complete',
                  },
                  {
                    id: r.requestId,
                    role: 'assistant',
                    content: '',
                    status: 'preparing',
                  },
                ],
              }
            : x,
        ),
      }));
      await persist(s);
      if (!valid(s) || run.current !== r) return;
      const patch = (fields: Partial<HistoryMessage>) => {
        if (!valid(s) || run.current !== r) return;
        r.accepted = true;
        change((h) => ({
          ...h,
          conversations: h.conversations.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  messages: x.messages.map((m) =>
                    m.id === r.requestId ? { ...m, ...fields } : m,
                  ),
                }
              : x,
          ),
        }));
      };
      if (r.local) {
        await latest.current.streamLocal!(
          question,
          before,
          r.controller.signal,
          patch,
        );
      } else
        await latest.current.stream(
          question,
          {
            conversationId: c.id,
            revision: current.revision!,
            requestId: r.requestId,
            userMessageId,
          },
          r.controller.signal,
          patch,
          current.digestContext,
        );
    } catch (error) {
      if (valid(s) && run.current === r) {
        setActionError(chatErrorKey(error));
        setSynced(false);
        if (before)
          change((h) => ({
            ...h,
            conversations: h.conversations.map((x) =>
              x.id === c.id
                ? {
                    ...x,
                    // Keep received partial text; server refresh reconciles an uncertain HTTP outcome.
                    recovery:
                      r.accepted && !r.local
                        ? {
                            requestId: r.requestId,
                            content:
                              x.messages.find((m) => m.id === r.requestId)
                                ?.content || '',
                            status: 'interrupted',
                          }
                        : undefined,
                    messages: r.accepted
                      ? x.messages.map((m) =>
                          m.id === r.requestId
                            ? { ...m, status: 'interrupted' }
                            : m,
                        )
                      : before!.messages,
                    draft: r.accepted ? x.draft : x.draft || question,
                    pending: false,
                    loaded: false,
                  }
                : x,
            ),
          }));
      }
    } finally {
      if (valid(s) && run.current === r) {
        run.current = null;
        setGeneratingId(null);
        setPreparingId(null);
        change((h) => ({
          ...h,
          conversations: h.conversations.map((x) =>
            x.id === c.id ? { ...x, pending: false, loaded: false } : x,
          ),
        }));
        await persist(s);
        if (!r.local) await refreshRef.current();
      }
    }
  };
  const remove = async (id: string) => {
    if (!ready) return;
    if (run.current?.id === id) stop();
    change((h) => {
      const conversations = h.conversations.map((c) =>
        c.id === id
          ? {
              ...c,
              deleting: true,
              recovery: undefined,
              draft: '',
              messages: [],
              title: '',
              digestContext: undefined,
            }
          : c,
      );
      if (!conversations.some((c) => !c.deleting))
        conversations.unshift(freshConversation());
      return {
        conversations,
        activeId:
          h.activeId === id
            ? conversations.find((c) => !c.deleting)!.id
            : h.activeId,
      };
    });
    await persist();
    await refreshRef.current();
  };
  const active =
    history.conversations.find(
      (c) => c.id === history.activeId && !c.deleting,
    ) || history.conversations.find((c) => !c.deleting)!;
  return {
    history,
    active,
    ready,
    // Both carry *translation keys*, not sentences: the view renders them with
    // its own dictionary so a locale switch updates a visible error.
    storageErrorKey: storageError,
    syncErrorKey: actionError || syncError,
    syncing,
    synced,
    localOnly,
    preparingId,
    generatingId,
    refresh: async () => {
      setActionError(null);
      await refresh();
    },
    send,
    stop,
    persist,
    setDraft: (draft: string) => {
      if (ready)
        change((h) => ({
          ...h,
          conversations: h.conversations.map((c) =>
            c.id === h.activeId ? { ...c, draft } : c,
          ),
        }));
    },
    open: (id: string) =>
      change((h) =>
        h.conversations.some((c) => c.id === id && !c.deleting)
          ? { ...h, activeId: id }
          : h,
      ),
    /**
     * `seed` supplies the digest conversation's title and prefilled draft. The
     * caller passes translated copy; the English default keeps the engine
     * usable (and testable) without a translator. The draft is *editable text
     * the user reviews before sending*, so localizing it is intended: it is not
     * a silent rewrite of a stored message.
     */
    startNew: (
      digestContext?: LocalConversation['digestContext'],
      seed: DigestSeedCopy = DEFAULT_DIGEST_SEED,
    ) => {
      if (!ready) return;
      stop();
      const c = freshConversation();
      if (digestContext) {
        c.digestContext = digestContext;
        c.title = seed.title;
        c.draft = digestContext.itemIds ? seed.sourceDraft : seed.digestDraft;
      }
      change((h) => ({
        activeId: c.id,
        conversations: [
          c,
          ...h.conversations.filter(
            (x) =>
              x.deleting ||
              x.revision !== undefined ||
              x.messages.length ||
              x.draft ||
              x.digestContext,
          ),
        ],
      }));
    },
    retry: () => {
      const c = state.current.conversations.find(
        (x) => x.id === state.current.activeId,
      );
      const m = [...(c?.messages || [])]
        .reverse()
        .find((x) => x.role === 'user');
      if (m) void send(m.content);
    },
    loadOlder: async () => {
      const s = session.current,
        c = state.current.conversations.find(
          (x) => x.id === state.current.activeId,
        );
      if (!s || !c?.before) return;
      try {
        await load(s, c.id, c.before);
      } catch (error) {
        if (valid(s)) setSyncError(chatErrorKey(error));
      }
    },
    deleteConversation: remove,
    retryStorage: async () => {
      setActionError(null);
      const s = session.current;
      if (!s) return;
      if (!s.writable) {
        try {
          const h = await latest.current.read(s.user);
          if (valid(s)) {
            change(() => h);
            s.writable = true;
            setReady(true);
            setStorageError(null);
          }
        } catch {
          return;
        }
      }
      await persist(s);
      await refreshRef.current();
    },
    removeAccountHistory: async () => {
      const s = session.current;
      if (!s) return;
      stop();
      s.writable = false;
      s.controller.abort();
      setReady(false);
      change(() => freshHistory());
      await latest.current.remove(s.user);
    },
  };
}
