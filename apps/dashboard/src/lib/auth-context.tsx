'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserDTO } from '@pubster/shared';
import { api, setSessionExpiredHandler } from './api-client';
import { clearTokens, getRefreshToken, hasStoredSession, setTokens } from './tokens';

/**
 * Client-side auth state for the dashboard.
 *
 * On mount it hydrates the current user from a stored session (`GET /auth/me`,
 * which transparently refreshes if the access token is stale). `login` calls
 * `POST /auth/login`, persists the token pair, and caches the user (role +
 * pubId). Route protection is handled by the protected layout reacting to
 * `status`.
 */

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: UserDTO | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserDTO | null>(null);

  useEffect(() => {
    // When a refresh ultimately fails, drop back to the unauthenticated state.
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });

    let cancelled = false;
    (async () => {
      if (!hasStoredSession()) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch {
        // Best-effort server-side revoke; the local session is cleared regardless.
      }
    }
    clearTokens();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
