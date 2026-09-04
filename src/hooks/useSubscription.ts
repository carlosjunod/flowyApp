import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mayCommit, satisfiesTarget, shouldPoll, type RefreshTarget } from '@/lib/entitlement';
import { pb } from '@/lib/pb';
import type { SubscriptionView } from '@/types';

export type { RefreshTarget };

/**
 * Scoped to the user. A bare ['subscription'] key lets a response fetched for
 * one account be read by the next one signed in on the same device.
 */
export const subscriptionKey = (userId: string | null) =>
  ['subscription', userId ?? 'anonymous'] as const;

/**
 * The live session identity, read from the auth store rather than React state:
 * a poll can outlive the component whose state would otherwise be consulted.
 */
const liveUserId = (): string | null => {
  const model = pb.authStore.model as { id?: string } | null;
  return model?.id ?? null;
};

const fetchSubscription = async (): Promise<SubscriptionView> => {
  const res = await api.getSubscription();
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

/** The server's view of what this user may do. The only entitlement source. */
export function useSubscription() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery<SubscriptionView, Error>({
    queryKey: subscriptionKey(userId),
    queryFn: fetchSubscription,
    enabled: userId !== null,
  });
}

export type RefreshResult = {
  view: SubscriptionView | null;
  /** True when the session changed mid-poll and the result was discarded. */
  aborted: boolean;
};

/**
 * Re-read entitlement after a purchase or restore.
 *
 * A completed StoreKit transaction is not yet an entitlement: RevenueCat has to
 * deliver its webhook and the server has to write the subscriptions row. That
 * is normally sub-second but is not synchronous with the purchase call, so poll
 * briefly rather than declaring failure on the first miss. Resolves with the
 * last view seen — whether or not it matched — and the caller decides what to
 * say.
 */
export function useRefreshSubscription() {
  const qc = useQueryClient();
  return useCallback(
    async (target: RefreshTarget = {}): Promise<RefreshResult> => {
      // Bind the whole poll to the identity that started it. If the user signs
      // out or switches accounts while it runs, the result is discarded rather
      // than written back over the new session's cache.
      const purchaserId = liveUserId();
      const aborted = (): boolean => !mayCommit(purchaserId, liveUserId());
      if (aborted()) return { view: null, aborted: true };

      const polling = shouldPoll(target);
      const attempts = polling ? [0, 1000, 2000, 3000, 4000] : [0];
      let last: SubscriptionView | null = null;
      for (const delay of attempts) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (aborted()) return { view: null, aborted: true };
        try {
          last = await fetchSubscription();
        } catch {
          // Keep polling: a transient network error during the webhook race is
          // not evidence the purchase failed.
          continue;
        }
        if (aborted()) return { view: null, aborted: true };
        if (!polling || satisfiesTarget(last, target)) break;
      }
      if (aborted()) return { view: null, aborted: true };
      if (last) qc.setQueryData(subscriptionKey(purchaserId), last);
      return { view: last, aborted: false };
    },
    [qc],
  );
}

/** Did the server actually land on what the caller bought? */
export function matchesTarget(view: SubscriptionView | null, target: RefreshTarget): boolean {
  return view ? satisfiesTarget(view, target) : false;
}
