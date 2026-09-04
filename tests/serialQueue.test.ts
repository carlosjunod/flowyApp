import { describe, expect, it } from 'vitest';

import { createSerialQueue } from '../src/lib/serialQueue';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('createSerialQueue', () => {
  it('never runs two tasks at once, even when the first is slow', async () => {
    // This is the purchase race in miniature: an identity change must not run
    // while a purchase is between its verification and its charge.
    const queue = createSerialQueue();
    const gate = deferred<void>();
    const order: string[] = [];
    let running = 0;
    let maxConcurrent = 0;

    const task = (name: string, wait?: Promise<void>) => async () => {
      running += 1;
      maxConcurrent = Math.max(maxConcurrent, running);
      order.push(`${name}:start`);
      if (wait) await wait;
      order.push(`${name}:end`);
      running -= 1;
      return name;
    };

    const first = queue(task('purchase', gate.promise));
    const second = queue(task('logout'));

    // The second task must not have started while the first is still awaiting.
    await Promise.resolve();
    expect(order).toEqual(['purchase:start']);

    gate.resolve();
    await expect(first).resolves.toBe('purchase');
    await expect(second).resolves.toBe('logout');

    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(['purchase:start', 'purchase:end', 'logout:start', 'logout:end']);
  });

  it('keeps running later tasks after one rejects', async () => {
    const queue = createSerialQueue();
    const failed = queue(async () => {
      throw new Error('identity check failed');
    });
    await expect(failed).rejects.toThrow('identity check failed');
    await expect(queue(async () => 'still works')).resolves.toBe('still works');
  });

  it('preserves submission order across many tasks', async () => {
    const queue = createSerialQueue();
    const seen: number[] = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        queue(async () => {
          await new Promise((r) => setTimeout(r, (6 - n) * 2));
          seen.push(n);
        }),
      ),
    );
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
});
