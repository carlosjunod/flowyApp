import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { pb } from '@/lib/pb';
import type { ApiError, ApiResult, PersonalizationProfile, PersonalizationInput } from '@/types';

export const personalizationQueryKey = (accountId: string | undefined) => ['personalization', accountId] as const;

export function usePersonalization(accountId: string | undefined) {
  const client = useQueryClient();
  const active = useRef({ accountId, mounted: true, busy: false });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    const scope = { accountId, mounted: true, busy: false };
    active.current = scope;
    setPending(false);
    setError(null);
    return () => { scope.mounted = false; };
  }, [accountId]);
  const query = useQuery({
    queryKey: personalizationQueryKey(accountId),
    enabled: !!accountId,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const result = await api.getPersonalization(accountId!, signal);
      if (result.error) throw result.error;
      return result.data;
    },
  });

  async function mutate(operation: () => Promise<ApiResult<PersonalizationProfile>>) {
    const scope = active.current;
    if (!accountId || scope.accountId !== accountId || !scope.mounted || scope.busy || pb.authStore.model?.id !== accountId) return null;
    scope.busy = true;
    setPending(true);
    setError(null);
    const isCurrent = () => scope.mounted && active.current === scope && pb.authStore.model?.id === accountId;
    try {
      // Discard older GETs before and after writing so they cannot replace the result.
      await client.cancelQueries({ queryKey: personalizationQueryKey(accountId) });
      if (!isCurrent()) return null;
      const result = await operation();
      if (!isCurrent()) return null;
      if (result.error) {
        setError(result.error);
        return null;
      }
      await client.cancelQueries({ queryKey: personalizationQueryKey(accountId) });
      if (!isCurrent()) return null;
      client.setQueryData(personalizationQueryKey(accountId), result.data);
      return result.data;
    } catch {
      if (isCurrent()) setError({ code: 'UNKNOWN', message: 'Could not update personalization. Please try again.' });
      return null;
    } finally {
      scope.busy = false;
      if (isCurrent()) setPending(false);
    }
  }

  return {
    ...query,
    pending,
    mutationError: error,
    resetMutationError: () => setError(null),
    save: (profile: PersonalizationInput) => mutate(() => api.savePersonalization(accountId!, profile)),
    clear: (revision: number) => mutate(() => api.clearPersonalization(accountId!, revision)),
  };
}
