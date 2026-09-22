import type { ApiError } from '@/types';

/**
 * Translation key for an API failure.
 *
 * `ApiError.message` is not prose: `parseError` in `lib/api.ts` sets it to the
 * server's `error` field, which is the *code* itself. Rendering it put strings
 * like "ORIGINAL_REQUIRED" in front of users even in English. The code is the
 * contract and stays as it is; this maps it to a sentence.
 *
 * Unknown codes fall back to `common.errors.DEFAULT` rather than leaking the
 * raw value — a new server code should read as a generic failure, not as
 * machine output.
 */
export function apiErrorKey(error: Pick<ApiError, 'code'>): string {
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 'common.errors.UNAUTHORIZED';
    case 'FORBIDDEN':
      return 'common.errors.FORBIDDEN';
    case 'NOT_FOUND':
    case 'ITEM_NOT_FOUND':
      return 'common.errors.NOT_FOUND';
    case 'RATE_LIMITED':
      return 'common.errors.RATE_LIMITED';
    case 'NETWORK_ERROR':
      return 'common.errors.NETWORK_ERROR';
    case 'SERVER_ERROR':
      return 'common.errors.SERVER_ERROR';
    case 'INVALID_INPUT':
    case 'INVALID_BODY':
      return 'common.errors.INVALID_INPUT';
    case 'ORIGINAL_REQUIRED':
      return 'common.errors.ORIGINAL_REQUIRED';
    default:
      return 'common.errors.DEFAULT';
  }
}

/**
 * Translation key for an error caught from a `try`/`catch`, where the
 * failure may be a structured `ApiError` or a plain `Error` re-thrown by a
 * React Query mutation (see `useDeleteItem`/`usePatchItem` in
 * `hooks/useItems.ts`, which do `throw new Error(res.error.message)`).
 *
 * Those mutations discard the error object but not its meaning: `message`
 * is already the server's error *code*, exactly like `ApiError.message` (see
 * `apiErrorKey` above), so it maps through the same switch. A message that
 * isn't a known code — a thrown `TypeError`, "Failed to fetch", a locked
 * keychain — falls back to `fallbackKey`, the screen's own generic copy,
 * rather than to the more generic `common.errors.DEFAULT`. Never pass
 * `err.message` itself to the user.
 */
export function caughtErrorKey(err: unknown, fallbackKey: string): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as Pick<ApiError, 'code'>).code
      : err instanceof Error
        ? (err.message as ApiError['code'])
        : undefined;
  if (!code) return fallbackKey;
  const key = apiErrorKey({ code });
  return key === 'common.errors.DEFAULT' ? fallbackKey : key;
}
