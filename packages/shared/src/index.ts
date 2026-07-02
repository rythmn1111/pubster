/**
 * @pubster/shared — shared TypeScript types / API contracts.
 *
 * Consumed by the backend (`services/api`), the web dashboard (`apps/dashboard`),
 * and — via generation — the iOS client. This is a Phase-1 SKELETON: only a few
 * placeholder types live here. Real response contracts will be exported from the
 * Fastify/zod schemas as modules land (see docs/ROADMAP.md "Cross-cutting").
 */

// ---------------------------------------------------------------------------
// Roles (mirrors Prisma enum UserRole — see docs/DATABASE.md)
// ---------------------------------------------------------------------------
export type UserRole = 'consumer' | 'staff' | 'manager' | 'super_admin';

// ---------------------------------------------------------------------------
// Canonical API error envelope.
// Every non-2xx response uses this shape (see docs/BACKEND.md §Conventions).
// ---------------------------------------------------------------------------
export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorBody {
  error: ApiErrorShape;
}

// ---------------------------------------------------------------------------
// Placeholder DTO stubs (fleshed out per-module in later phases).
// ---------------------------------------------------------------------------

/** `GET /health` and `GET /api/v1/health`. */
export interface HealthResponse {
  status: 'ok';
}

/** Access + refresh token pair returned by auth endpoints. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Minimal public view of an authenticated user. */
export interface UserDTO {
  id: string;
  role: UserRole;
  name: string;
  phone?: string | null;
  email?: string | null;
  pubId?: string | null;
}

/** A pub as returned by `GET /api/v1/pubs/nearest`, ordered by distance. */
export interface NearestPubDTO {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}
