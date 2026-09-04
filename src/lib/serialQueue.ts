// A one-at-a-time async queue.
//
// Extracted from the purchases module so the ordering guarantee can be unit
// tested: it is the mechanism that stops a RevenueCat logIn or logOut from
// landing between "verify the app user id" and "charge the card".

export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    // Run after whatever is queued, whether it settled or threw — a rejected
    // task must not stall every later caller.
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
