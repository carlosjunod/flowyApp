/**
 * Run an async attempt at most once at a time, remember success forever, and
 * forget failure so a later caller can retry.
 *
 * A plain memoised promise is wrong for anything that can fail transiently:
 * caching the failed attempt means the first bad startup disables the feature
 * for the life of the process, and no amount of reopening the screen helps.
 */
export function createRetryableOnce(attempt: () => Promise<boolean>): () => Promise<boolean> {
  let inFlight: Promise<boolean> | null = null;
  let succeeded = false;

  return (): Promise<boolean> => {
    if (succeeded) return Promise.resolve(true);
    if (inFlight) return inFlight;

    // Invoke through a resolved promise so a synchronous throw inside `attempt`
    // is caught here rather than escaping past the bookkeeping below.
    const run = Promise.resolve()
      .then(attempt)
      .then(
        (ok) => {
          if (ok) succeeded = true;
          return ok;
        },
        () => false,
      );

    inFlight = run;
    // Drop the cached failure — but only if nothing has replaced this attempt.
    void run.then((ok) => {
      if (!ok && inFlight === run) inFlight = null;
    });
    return run;
  };
}
