import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@pubster/shared';
import { env } from '../config/env.js';

/**
 * JWT + refresh-token helpers (see docs/BACKEND.md §Auth design).
 *
 * Access tokens are short-lived (~15m) JWTs carrying `{ sub, role, pubId? }`.
 * Refresh tokens are opaque random strings (NOT JWTs): the raw value is handed
 * to the client, only its SHA-256 hash is persisted in the `RefreshToken`
 * table, and it is rotated on every refresh.
 */
export interface AccessTokenClaims {
  /** user id */
  sub: string;
  role: UserRole;
  /** present for staff/manager (pub-scoped) tokens */
  pubId?: string;
}

/** Number of random bytes behind an opaque refresh token (256 bits). */
const REFRESH_TOKEN_BYTES = 32;

export function signAccessToken(claims: AccessTokenClaims): string {
  const options = { expiresIn: env.ACCESS_TOKEN_TTL } as SignOptions;
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  // `decoded` is `string | JwtPayload`; narrow to our claim shape.
  if (typeof decoded === 'string') {
    throw new Error('Unexpected string JWT payload');
  }
  return decoded as AccessTokenClaims;
}

/**
 * Generate a fresh opaque refresh token. High-entropy, URL-safe, and never a
 * JWT — the server keeps only its {@link hashRefreshToken} digest.
 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * Deterministic SHA-256 hash of a refresh token, used both for storage and for
 * constant-shape lookups. Never store or log the raw token.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
