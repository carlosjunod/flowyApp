// Module-scoped transaction lock.
//
// A component-local ref is not enough: the user can close the paywall while a
// purchase or its entitlement poll is still running, and reopening it would
// build a second, unlocked instance that happily starts another StoreKit
// transaction. The lock has to outlive the screen, so it lives here.
//
// Exposed as an external store so any mounted paywall — including one mounted
// after the transaction began — renders the locked state.

let inFlight = false;
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

export function isTransactionInFlight(): boolean {
  return inFlight;
}

/** Acquire the lock. Returns false when a transaction is already running. */
export function beginTransaction(): boolean {
  if (inFlight) return false;
  inFlight = true;
  emit();
  return true;
}

/** Release the lock. Safe to call when it is not held. */
export function endTransaction(): void {
  if (!inFlight) return;
  inFlight = false;
  emit();
}

export function subscribeTransaction(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
