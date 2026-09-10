import type { ChatTurn, HistoryOperation } from './chatContract';
import type { DigestChatContext } from '@/types';
import type {
  AliasData,
  ApiError,
  ApiErrorCode,
  ApiResult,
  AuthSession,
  BulkActionPayload,
  BulkActionResult,
  CitedItem,
  Digest,
  DigestSettings,
  DigestPreferences,
  IngestPayload,
  IngestResponse,
  Item,
  PersonalizationProfile,
  PersonalizationInput,
} from '@/types';

import { ENV } from './env';
import { pb } from './pb';

const codeFromStatus = (status: number): ApiErrorCode => {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400 || status === 422) return 'INVALID_INPUT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
};

const authHeader = (): Record<string, string> => {
  const token = pb.authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const jsonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...authHeader(),
});

type ErrorBody = { error?: string; message?: string };

const parseError = async (res: Response, historyRequest = false): Promise<ApiError> => {
  let code: ApiErrorCode = codeFromStatus(res.status);
  let message = res.statusText || 'Request failed';
  let rawBody: string | undefined;
  let hasErrorCode = false;
  try {
    rawBody = await res.text();
    const body = (rawBody ? JSON.parse(rawBody) : {}) as ErrorBody;
    if (typeof body.error === 'string' && body.error) {
      hasErrorCode = true;
      code = (body.error as ApiErrorCode) ?? code;
      message = body.error;
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // keep defaults
  }
  if (historyRequest && res.status === 404 && !hasErrorCode) {
    code = 'CHAT_HISTORY_UNAVAILABLE';
    message = 'Chat history is not available on this server.';
  }
  console.log('[api] error response', {
    url: res.url,
    status: res.status,
    code,
    message,
  });
  return { code, message, status: res.status };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const url = `${ENV.API_BASE_URL}${path}`;
  try {
    console.log('[api] ->', init.method ?? 'GET', url);
    const res = await fetch(url, {
      ...init,
      headers: { ...jsonHeaders(), ...(init.headers ?? {}) },
    });
    if (!res.ok) return { data: null, error: await parseError(res, path === '/api/chat/history') };
    const body = (await res.json()) as { data?: T };
    const data = (body.data ?? (body as unknown as T)) as T;
    return { data, error: null };
  } catch (err) {
    console.log('[api] network error', {
      url,
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

/** Bind profile calls to their originating session, including late responses. */
async function personalizationRequest(
  accountId: string,
  init: RequestInit = {},
): Promise<ApiResult<PersonalizationProfile>> {
  const token = pb.authStore.token;
  const sameSession = () => !!token && pb.authStore.model?.id === accountId && pb.authStore.token === token;
  const sessionError: ApiResult<PersonalizationProfile> = {
    data: null, error: { code: 'UNAUTHORIZED', message: 'Your session changed. Please reopen personalization.' },
  };
  if (!sameSession()) return sessionError;
  const result = await request<PersonalizationProfile>('/api/profile/personalization', {
    ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  return sameSession() ? result : sessionError;
}

export type ItemsResponse = { items: Item[]; page: number; perPage: number; totalItems: number; totalPages: number; categories: string[] };

export const api = {
  getPersonalization: (accountId: string, signal?: AbortSignal) =>
    personalizationRequest(accountId, { signal }),
  savePersonalization: (accountId: string, profile: PersonalizationInput) =>
    personalizationRequest(accountId, { method: 'PUT', body: JSON.stringify(profile) }),
  clearPersonalization: (accountId: string, revision: number) =>
    personalizationRequest(accountId, { method: 'DELETE', body: JSON.stringify({ revision }) }),

  listItems: (params: { q?: string; category?: string; sort?: string; direction?: string; page?: number; perPage?: number }) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
    return request<ItemsResponse>(`/api/items?${query.toString()}`);
  },
  ingest: (payload: IngestPayload) =>
    request<IngestResponse>('/api/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  patchItem: (
    id: string,
    patch: Partial<Pick<Item, 'title' | 'summary' | 'category' | 'tags'>>,
  ) =>
    request<Item>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteItem: (id: string) =>
    request<{ ok: true }>(`/api/items/${id}`, {
      method: 'DELETE',
    }),

  reloadItem: (id: string) =>
    request<Item>(`/api/items/${id}/retry`, {
      method: 'POST',
    }),

  bulkDeleteItems: (payload: BulkActionPayload) =>
    request<BulkActionResult>('/api/items/bulk/delete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  bulkReloadItems: (payload: BulkActionPayload) =>
    request<BulkActionResult>('/api/items/bulk/reload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exploreMany: (
    ids: string[],
    options: { deep?: boolean; includeVideoFrames?: boolean } = {},
  ) =>
    request<BulkActionResult>('/api/items/bulk/explore', {
      method: 'POST',
      body: JSON.stringify({ ids, ...options }),
    }),

  registerEmail: (email: string, password: string, name?: string) =>
    request<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  authGoogle: (idToken: string, email?: string) =>
    request<AuthSession>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken, email }),
    }),

  /**
   * `authorizationCode` is the one-time code Apple returns alongside the
   * identity token. The server trades it for a refresh token so it can revoke
   * Flowy's access when the account is deleted — Apple requires that of any
   * app offering Sign in with Apple plus account deletion. Optional: sign-in
   * works without it, only revocation is lost.
   */
  authApple: (identityToken: string, email?: string, authorizationCode?: string) =>
    request<AuthSession>('/api/auth/apple', {
      method: 'POST',
      body: JSON.stringify({
        identity_token: identityToken,
        email,
        authorization_code: authorizationCode,
      }),
    }),

  /**
   * Permanently delete the signed-in account. App Store Review 5.1.1(v)
   * requires this to be reachable in-app. Irreversible: the server revokes the
   * Apple token, deletes the user (cascading every item), and sweeps the
   * search index and uploaded files.
   */
  deleteAccount: (confirmation: string) =>
    request<{ deleted: true; warnings: string[] }>('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation }),
    }),

  readDigest: (id: string) => request<Record<string, never>>(`/api/digest/${id}/read`, {method:'POST'}),

  listDigests: () => request<Digest[]>('/api/digest'),
  listDigestPage: async (cursor:string|null, filters:{cadence?:'daily'|'weekly';read?:'read'|'new'}={}):Promise<{items:Digest[];nextCursor:string|null}> => {
    const params=new URLSearchParams(filters);if(cursor)params.set('cursor',cursor);
    const response=await fetch(ENV.API_BASE_URL+'/api/digest?'+params.toString(),{headers:jsonHeaders()});
    if(!response.ok)throw new Error('Could not load reports. Check your connection and retry.');
    const body=await response.json() as {data:Digest[];nextCursor:string|null};return {items:body.data,nextCursor:body.nextCursor};
  },
  digestFeedback: (id:string,target:string,value:'useful'|'not_useful'|'not_interested'|null)=>request(`/api/digest/${id}/feedback`,{method:'POST',body:JSON.stringify({target,value})}),
  digestItemOpened: (id:string,target:string)=>request(`/api/digest/${id}/events`,{method:'POST',body:JSON.stringify({name:'digest_item_opened',target})}),
  testDigestEmail: (id:string)=>request(`/api/digest/${id}/test-email`,{method:'POST'}),

  getDigest: (id: string) => request<Digest>(`/api/digest/${id}`),

  getDigestSettings: () => request<DigestSettings>('/api/digest/settings'),

  patchDigestSettings: (patch: Partial<DigestPreferences> & { expected_revision: number }) =>
    request<DigestSettings>('/api/digest/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getEmailAlias: () => request<AliasData>('/api/account/alias'),

  regenerateEmailAlias: () =>
    request<AliasData>('/api/account/alias', { method: 'POST' }),
};

export type ChatStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'sources'; citations: CitedItem[] }
  | { type: 'done'; citations: CitedItem[] }
  | { type: 'error'; error: ApiError };

export async function* chatStream(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  signal?: AbortSignal,
  digestContext?: DigestChatContext,
  turn?: ChatTurn,
): AsyncGenerator<ChatStreamEvent, void, void> {
  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ message, history, digestContext, turn }),
      signal,
    });
  } catch (err) {
    yield {
      type: 'error',
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
    return;
  }
  if (!res.ok) {
    yield { type: 'error', error: await parseError(res) };
    return;
  }
  let citations: CitedItem[] = [];
  const header = res.headers.get('x-items');
  if (header) {
    try {
      // Validate the shape, don't just cast it. Any syntactically valid
      // non-array (`{}`, `null`, `"x"`) would otherwise reach `.map()` in
      // ChatMessage and crash the whole conversation view.
      const raw: unknown = JSON.parse(header);
      // Server metadata uses null for absent fields; native renderers use undefined.
      const parsed: unknown = Array.isArray(raw) ? raw.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        const normalized = {...value} as Record<string, unknown>;
        for (const key of ['title','category','source_url','raw_url','r2_key','og_image','site_name']) {
          if (normalized[key] === null) delete normalized[key];
        }
        return normalized;
      }) : raw;
      // Checking `id` alone is not enough: these fields are rendered straight
      // into <Text>, so an object-valued `title` or `category` throws
      // "Objects are not valid as a React child" and takes the chat down.
      const isStringOrAbsent = (v: unknown): boolean => v === undefined || typeof v === 'string';
      citations = Array.isArray(parsed)
        ? parsed.filter((c): c is CitedItem => {
            if (typeof c !== 'object' || c === null) return false;
            const o = c as Record<string, unknown>;
            return (
              typeof o.id === 'string' &&
              typeof o.type === 'string' &&
              isStringOrAbsent(o.title) &&
              isStringOrAbsent(o.category) &&
              isStringOrAbsent(o.source_url) &&
              isStringOrAbsent(o.r2_key)
            );
          })
        : [];
    } catch {
      citations = [];
    }
  }

  yield { type: 'sources', citations };
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text) yield { type: 'token', value: text };
    yield { type: 'done', citations };
    return;
  }
  const decoder = new TextDecoder();
  try {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) yield { type: 'token', value: chunk };
  }
  const tail = decoder.decode();
  if (tail) yield { type: 'token', value: tail };
  yield { type: 'done', citations };
  } finally {
    if (signal?.aborted) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export const chatHistoryRequest = <T>(operation: HistoryOperation, signal?: AbortSignal): Promise<ApiResult<T>> => request<T>('/api/chat/history', {method:'POST',body:JSON.stringify(operation),signal});
