import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { api } from '@/lib/api';
import { instagramChatUrl, instagramConnectionErrorKey, instagramConnectionUrl } from '@/lib/instagramConnection';
import { pb } from '@/lib/pb';
import type { ApiError, ApiResult, InstagramConnection } from '@/types';

export const instagramQueryKey = (accountId?: string, destination?: string) => ['instagram-connection', accountId, destination] as const;

export function useInstagramConnection(accountId?: string, destination?: string) {
  const client = useQueryClient();
  const active = useRef({ accountId, destination, mounted: true, busy: false });
  const handoff = useRef(false);
  const [issued, setIssued] = useState<{ accountId: string; destination?: string; connection: InstagramConnection } | null>(null);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [handoffReturned, setHandoffReturned] = useState(false);
  useEffect(() => {
    const scope = { accountId, destination, mounted: true, busy: false };
    active.current = scope;
    setIssued(null); setPending(false); setErrorKey(null); setCopied(false);
    handoff.current = false; setHandoffReturned(false);
    return () => { scope.mounted = false; };
  }, [accountId, destination]);
  const query = useQuery<InstagramConnection, ApiError>({
    queryKey: instagramQueryKey(accountId, destination), enabled: !!accountId, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const result = await api.getInstagramConnection(accountId!, signal, destination);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const connection = issued?.accountId === accountId && issued?.destination === destination && !query.data?.connected ? issued?.connection : null;
  const expired = !!connection && (connection.expiresAt ?? 0) <= now;
  const { refetch } = query;
  useEffect(() => {
    if (query.data?.connected) { setIssued(null); setCopied(false); handoff.current = false; setHandoffReturned(false); }
  }, [query.data?.connected]);
  useEffect(() => { if (expired) setHandoffReturned(false); }, [expired]);
  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      if (accountId && pb.authStore.model?.id === accountId) void refetch();
    };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
        if (handoff.current && connection && (connection.expiresAt ?? 0) > Date.now() && !query.data?.connected) setHandoffReturned(true);
      }
    });
    const timer = connection ? setInterval(() => {
      setNow(Date.now());
      if (AppState.currentState === 'active' && (connection.expiresAt ?? 0) > Date.now()) refresh();
    }, 5000) : undefined;
    return () => { subscription.remove(); if (timer) clearInterval(timer); };
  }, [accountId, connection, query.data?.connected, refetch]);

  function current(scope: typeof active.current) {
    return !!accountId && scope.mounted && scope === active.current && scope.accountId === accountId && scope.destination === destination && pb.authStore.model?.id === accountId;
  }
  async function open(url: string) {
    const scope = active.current;
    if (!current(scope)) return false;
    setErrorKey(null);
    try { await Linking.openURL(url); return true; }
    catch { if (current(scope)) setErrorKey('settings.instagram.errors.openFailed'); return false; }
  }
  async function mutate(operation: () => Promise<ApiResult<InstagramConnection>>) {
    const scope = active.current;
    if (!current(scope) || scope.busy) return null;
    scope.busy = true; setPending(true); setErrorKey(null); setCopied(false);
    try {
      await client.cancelQueries({ queryKey: instagramQueryKey(accountId, destination) });
      if (!current(scope)) return null;
      const result = await operation();
      if (!current(scope)) return null;
      if (result.error) { setErrorKey(instagramConnectionErrorKey(result.error.code)); return null; }
      await client.cancelQueries({ queryKey: instagramQueryKey(accountId, destination) });
      if (!current(scope)) return null;
      // Connection secrets live only in this mounted screen, never in query caches.
      const { code, expiresAt, ...status } = result.data;
      client.setQueryData(instagramQueryKey(accountId, destination), status);
      setIssued(code ? { accountId: accountId!, destination, connection: result.data } : null);
      setNow(Date.now());
      return result.data;
    } catch {
      if (current(scope)) setErrorKey('settings.instagram.errors.updateFailed');
      return null;
    } finally { scope.busy = false; if (current(scope)) setPending(false); }
  }
  async function connect(regenerate = false) {
    if (regenerate) { handoff.current = false; setHandoffReturned(false); }
    const existing = connection && instagramConnectionUrl(connection);
    if (!regenerate && existing) { if (await open(existing)) handoff.current = true; return; }
    const next = await mutate(() => api.createInstagramConnection(accountId!, destination || query.data?.account));
    const url = next && instagramConnectionUrl(next);
    if (url) { if (await open(url)) handoff.current = true; }
  }
  async function copyCode() {
    const scope = active.current;
    if (!current(scope) || !connection?.code || (connection.expiresAt ?? 0) <= Date.now()) return;
    try { await Clipboard.setStringAsync(connection.code); if (current(scope)) setCopied(true); }
    catch { if (current(scope)) setErrorKey('settings.instagram.errors.copyFailed'); }
  }
  return {
    ...query, pending, errorKey: errorKey || (query.error ? instagramConnectionErrorKey(query.error.code) : null),
    connection, expired, copied, connect, copyCode, handoffReturned,
    refresh: () => { setErrorKey(null); setNow(Date.now()); void refetch(); },
    openChat: () => open(instagramChatUrl(query.data)),
    disconnect: () => { handoff.current = false; setHandoffReturned(false); return mutate(() => api.disconnectInstagram(accountId!, destination || query.data?.account)); },
  };
}
