import type {
  ApiError,
  ApiErrorCode,
  ApiResult,
  CitedItem,
  IngestPayload,
  IngestResponse,
  Item,
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

const parseError = async (res: Response): Promise<ApiError> => {
  let code: ApiErrorCode = codeFromStatus(res.status);
  let message = res.statusText || 'Request failed';
  try {
    const body = (await res.json()) as ErrorBody;
    if (body.error) {
      code = (body.error as ApiErrorCode) ?? code;
      message = body.error;
    } else if (body.message) {
      message = body.message;
    }
  } catch {
    // keep defaults
  }
  return { code, message, status: res.status };
};

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${ENV.API_BASE_URL}${path}`, {
      ...init,
      headers: { ...jsonHeaders(), ...(init.headers ?? {}) },
    });
    if (!res.ok) return { data: null, error: await parseError(res) };
    const body = (await res.json()) as { data?: T };
    const data = (body.data ?? (body as unknown as T)) as T;
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

export const api = {
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
};

export type ChatStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'done'; citations: CitedItem[] }
  | { type: 'error'; error: ApiError };

export async function* chatStream(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, void> {
  let res: Response;
  try {
    res = await fetch(`${ENV.API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ message, history }),
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
      citations = JSON.parse(header) as CitedItem[];
    } catch {
      citations = [];
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text) yield { type: 'token', value: text };
    yield { type: 'done', citations };
    return;
  }
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) yield { type: 'token', value: chunk };
  }
  const tail = decoder.decode();
  if (tail) yield { type: 'token', value: tail };
  yield { type: 'done', citations };
}
