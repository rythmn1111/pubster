import { z } from 'zod';
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

/**
 * zod request/response schemas for the auth module (docs/BACKEND.md §API surface).
 * Request schemas validate input (→ 400); response schemas double as OpenAPI docs
 * and are kept structurally in sync with the shared DTOs via the `satisfies`
 * assertions below.
 */

// E.164-ish phone: a leading '+' and 7–15 digits. Kept lenient for dummy OTP.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number');

// --- Request bodies ---------------------------------------------------------

export const otpRequestBodySchema = z.object({
  phone,
});

export const otpVerifyBodySchema = z.object({
  phone,
  code: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
});

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(1),
});

// --- Responses --------------------------------------------------------------

export const userDtoSchema = z.object({
  id: z.string(),
  role: z.enum(['consumer', 'staff', 'manager', 'super_admin']),
  name: z.string().nullable(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  pubId: z.string().nullable().optional(),
});

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const authResponseSchema = tokenPairSchema.extend({
  user: userDtoSchema,
});

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

// --- Contract checks: schemas must match the shared DTOs --------------------

type _AssertOtpRequest =
  z.infer<typeof otpRequestBodySchema> extends OtpRequestRequest ? true : never;
type _AssertOtpVerify = z.infer<typeof otpVerifyBodySchema> extends OtpVerifyRequest ? true : never;
type _AssertLogin = z.infer<typeof loginBodySchema> extends LoginRequest ? true : never;
type _AssertRefresh = z.infer<typeof refreshBodySchema> extends RefreshRequest ? true : never;
type _AssertLogout = z.infer<typeof logoutBodySchema> extends LogoutRequest ? true : never;
type _AssertUser = z.infer<typeof userDtoSchema> extends UserDTO ? true : never;
type _AssertTokenPair = z.infer<typeof tokenPairSchema> extends TokenPair ? true : never;
type _AssertAuthResponse = z.infer<typeof authResponseSchema> extends AuthResponse ? true : never;
type _AssertOk = z.infer<typeof okResponseSchema> extends OkResponse ? true : never;

// Force the assertions to be evaluated (all must be `true`).
const _contracts: [
  _AssertOtpRequest,
  _AssertOtpVerify,
  _AssertLogin,
  _AssertRefresh,
  _AssertLogout,
  _AssertUser,
  _AssertTokenPair,
  _AssertAuthResponse,
  _AssertOk,
] = [true, true, true, true, true, true, true, true, true];
void _contracts;
