import { describe, expect, it, vi } from 'vitest';

import { createRetryableOnce } from '../src/lib/retryableOnce';

describe('createRetryableOnce', () => {
  it('retries after a failure instead of caching it forever', async () => {
    // The bug this prevents: a transient RevenueCat configure failure used to
    // be cached, leaving purchases dead until the user force-quit the app —
    // while the UI told them to try again.
    const attempt = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const once = createRetryableOnce(attempt);

    await expect(once()).resolves.toBe(false);
    await expect(once()).resolves.toBe(true);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('treats a thrown attempt as a retryable failure', async () => {
    const attempt = vi
      .fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(new Error('native module missing'))
      .mockResolvedValueOnce(true);
    const once = createRetryableOnce(attempt);

    await expect(once()).resolves.toBe(false);
    await expect(once()).resolves.toBe(true);
  });

  it('survives an attempt that throws synchronously', async () => {
    let first = true;
    const once = createRetryableOnce(() => {
      if (first) {
        first = false;
        throw new Error('sync boom');
      }
      return Promise.resolve(true);
    });

    await expect(once()).resolves.toBe(false);
    await expect(once()).resolves.toBe(true);
  });

  it('never runs a second attempt once one has succeeded', async () => {
    const attempt = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    const once = createRetryableOnce(attempt);

    await expect(once()).resolves.toBe(true);
    await expect(once()).resolves.toBe(true);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight attempt between concurrent callers', async () => {
    let resolve!: (v: boolean) => void;
    const attempt = vi.fn<() => Promise<boolean>>(
      () => new Promise<boolean>((res) => {
        resolve = res;
      }),
    );
    const once = createRetryableOnce(attempt);

    const a = once();
    const b = once();
    // The attempt is invoked in a microtask, so let it run before resolving.
    await Promise.resolve();
    await Promise.resolve();
    resolve(true);
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
