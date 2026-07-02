import type { TokenPair } from '@pubster/shared';

/**
 * Access + refresh token persistence.
 *
 * Tokens live in `localStorage` so a page reload keeps the session. All access
 * is guarded for SSR (`window` is undefined on the server), so these helpers
 * are safe to import from any module.
 */

const ACCESS_KEY = 'pubster.accessToken';
const REFRESH_KEY = 'pubster.refreshToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: TokenPair): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export function hasStoredSession(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}
