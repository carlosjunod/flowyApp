import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ApiError, AuthSession } from '@/types';

import { ENV } from './env';
import { hydratePbAuth, pb } from './pb';
import { sharedSecureStore } from './secureStore';

type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<{ error: ApiError | null }>;
  signInWithSession: (session: AuthSession) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const toUser = (model: unknown): AuthUser | null => {
  if (!model || typeof model !== 'object') return null;
  const m = model as { id?: string; email?: string; name?: string };
  if (!m.id || !m.email) return null;
  return { id: m.id, email: m.email, name: m.name };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await hydratePbAuth();
      } catch (err) {
        if (__DEV__) console.warn('[auth] hydrate failed, continuing unauthenticated:', err);
      }
      if (!mounted) return;
      setUser(toUser(pb.authStore.model));
      setReady(true);
    })();
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(toUser(pb.authStore.model));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    try {
      await pb.collection('users').authWithPassword(email, password);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      const status = (err as { status?: number } | null)?.status;
      return {
        error: {
          code: status === 400 ? 'INVALID_INPUT' : 'UNAUTHORIZED',
          message,
          status,
        },
      };
    }
  }, []);

  const signInWithSession = useCallback<AuthContextValue['signInWithSession']>(
    async (session) => {
      pb.authStore.save(session.token, {
        id: session.userId,
        email: session.email,
        collectionId: '_pb_users_auth_',
        collectionName: 'users',
      } as Parameters<typeof pb.authStore.save>[1]);
    },
    [],
  );

  const signOut = useCallback(async () => {
    pb.authStore.clear();
    await sharedSecureStore.removeItem(ENV.AUTH_KEY);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, signIn, signInWithSession, signOut }),
    [user, ready, signIn, signInWithSession, signOut],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
