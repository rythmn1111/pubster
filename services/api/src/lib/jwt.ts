import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@pubster/shared';
import { env } from '../config/env.js';

/**
 * JWT helpers (skeleton).
 *
 * Access tokens are short-lived (~15m) and carry `{ sub, role, pubId? }`.
 * Refresh tokens are opaque random strings stored HASHED in the DB and rotated
 * on refresh — those are NOT JWTs and are handled by the auth service later
 * (see docs/BACKEND.md §Auth design). Real logic lands with the auth module.
 */
export interface AccessTokenClaims {
  /** user id */
  sub: string;
  role: UserRole;
  /** present for staff/manager (pub-scoped) tokens */
  pubId?: string;
}

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
