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
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** @deprecated Kept as an alias of {@link TokenPair} for older callers. */
export type AuthTokens = TokenPair;

/** Minimal public view of an authenticated user. */
export interface UserDTO {
  id: string;
  role: UserRole;
  /** Consumers created via OTP may not have supplied a name yet. */
  name: string | null;
  phone?: string | null;
  email?: string | null;
  pubId?: string | null;
}

// ---------------------------------------------------------------------------
// Auth request / response contracts (see docs/BACKEND.md §Auth design).
// ---------------------------------------------------------------------------

/** `POST /api/v1/auth/otp/request` body. */
export interface OtpRequestRequest {
  phone: string;
}

/** `POST /api/v1/auth/otp/verify` body (consumer dummy-OTP login). */
export interface OtpVerifyRequest {
  phone: string;
  code: string;
  /** First-time consumers may supply their name here. */
  name?: string;
}

/** `POST /api/v1/auth/login` body (staff/manager/super-admin email+password). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** `POST /api/v1/auth/refresh` body. */
export interface RefreshRequest {
  refreshToken: string;
}

/** `POST /api/v1/auth/logout` body. */
export interface LogoutRequest {
  refreshToken: string;
}

/** Token pair plus the authenticated user (OTP verify + login responses). */
export interface AuthResponse extends TokenPair {
  user: UserDTO;
}

/** Simple acknowledgement envelope (e.g. `POST /auth/otp/request`, `/auth/logout`). */
export interface OkResponse {
  ok: true;
}

/** A pub as returned by `GET /api/v1/pubs/nearest`, ordered by distance. */
export interface NearestPubDTO {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}
