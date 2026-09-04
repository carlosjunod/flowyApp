import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { api } from '@/lib/api';
import { satisfiesTarget, shouldPoll, type RefreshTarget } from '@/lib/entitlement';
import type { SubscriptionView } from '@/types';

export type { RefreshTarget };

export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

const fetchSubscription = async (): Promise<SubscriptionView> => {
  const res = await api.getSubscription();
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

/** The server's view of what this user may do. The only entitlement source. */
export function useSubscription() {
  return useQuery<SubscriptionView, Error>({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: fetchSubscription,
  });
}

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
    async (target: RefreshTarget = {}): Promise<SubscriptionView | null> => {
      const polling = shouldPoll(target);
      const attempts = polling ? [0, 1000, 2000, 3000, 4000] : [0];
      let last: SubscriptionView | null = null;
      for (const delay of attempts) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        try {
          last = await fetchSubscription();
        } catch {
          // Keep polling: a transient network error during the webhook race is
          // not evidence the purchase failed.
          continue;
        }
        if (!polling || satisfiesTarget(last, target)) break;
      }
      if (last) qc.setQueryData(SUBSCRIPTION_QUERY_KEY, last);
      return last;
    },
    [qc],
  );
}

/** Did the server actually land on what the caller bought? */
export function matchesTarget(view: SubscriptionView | null, target: RefreshTarget): boolean {
  return view ? satisfiesTarget(view, target) : false;
}
