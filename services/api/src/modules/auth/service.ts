import type { User } from '@prisma/client';
import type {
  AuthResponse,
  LoginRequest,
  LogoutRequest,
  OkResponse,
  OtpRequestRequest,
  OtpVerifyRequest,
  RefreshRequest,
  TokenPair,
  UserDTO,
} from '@pubster/shared';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../../lib/jwt.js';
import { verifyPassword } from '../../lib/password.js';
import { UnauthorizedError } from '../../lib/errors.js';

/**
 * Auth business logic (docs/BACKEND.md §Auth design).
 *
 * - Consumer login: phone + dummy OTP (`DUMMY_OTP_CODE`). A REAL User row is
 *   upserted; only SMS is stubbed.
 * - Staff/manager/super-admin login: email + argon2 password.
 * - Access token: short-lived JWT. Refresh token: opaque random, stored hashed
 *   in `RefreshToken`, rotated on every refresh.
 */

/** Convert a Prisma `User` to the public {@link UserDTO}. */
function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    email: user.email,
    pubId: user.pubId,
  };
}

/** Parse a `<number><unit>` TTL (e.g. `30d`, `15m`, `900s`) into milliseconds. */
function durationToMs(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${input}"`);
  }
  const value = Number(match[1]);
  const unit = match[2] ?? 'ms';
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return value * unitMs[unit];
}

/**
 * Issue an access token and a fresh, persisted (hashed) refresh token for a user.
 */
async function issueTokens(user: User): Promise<TokenPair> {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    pubId: user.pubId ?? undefined,
  });

  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL));
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });

  return { accessToken, refreshToken };
}

/**
 * `POST /auth/otp/request` — dummy: no SMS is sent. We intentionally do NOT
 * reveal whether the phone maps to an existing user.
 */
export function requestOtp(_body: OtpRequestRequest): OkResponse {
  return { ok: true };
}

/**
 * `POST /auth/otp/verify` — dummy OTP. If the code matches `DUMMY_OTP_CODE`,
 * upsert a REAL consumer User by phone and issue tokens. Wrong code → 401.
 */
export async function verifyOtp(body: OtpVerifyRequest): Promise<AuthResponse> {
  if (body.code !== env.DUMMY_OTP_CODE) {
    throw new UnauthorizedError('Invalid OTP code');
  }

  const user = await prisma.user.upsert({
    where: { phone: body.phone },
    create: { role: 'consumer', phone: body.phone, name: body.name ?? null },
    // Only overwrite the name when the client supplied one.
    update: body.name ? { name: body.name } : {},
  });

  const tokens = await issueTokens(user);
  return { ...tokens, user: toUserDTO(user) };
}

/**
 * `POST /auth/login` — staff/manager/super-admin email + password. Uses a
 * generic error so callers can't probe which emails exist.
 */
export async function login(body: LoginRequest): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const ok = await verifyPassword(user.passwordHash, body.password);
  if (!ok) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = await issueTokens(user);
  return { ...tokens, user: toUserDTO(user) };
}

/**
 * `POST /auth/refresh` — validate the presented refresh token against its
 * stored hash (not revoked, not expired), ROTATE it (revoke old + issue new),
 * and return a new token pair. Reusing a rotated/old token → 401.
 */
export async function refresh(body: RefreshRequest): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(body.refreshToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt !== null || existing.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Rotate: revoke the presented token, then mint a new pair for its owner.
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(existing.user);
}

/**
 * `POST /auth/logout` — revoke the matching (still-active) refresh token.
 * Idempotent: unknown/already-revoked tokens still return `{ ok: true }`.
 */
export async function logout(body: LogoutRequest): Promise<OkResponse> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(body.refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { ok: true };
}

/** `GET /auth/me` — the current user for a verified access token. */
export async function getMe(userId: string): Promise<UserDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }
  return toUserDTO(user);
}
