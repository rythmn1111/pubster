import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  authResponseSchema,
  loginBodySchema,
  logoutBodySchema,
  okResponseSchema,
  otpRequestBodySchema,
  otpVerifyBodySchema,
  refreshBodySchema,
  tokenPairSchema,
  userDtoSchema,
} from './schema.js';
import * as service from './service.js';

/**
 * Auth routes — `/api/v1/auth/*` (docs/BACKEND.md §API surface).
 * Registered in `app.ts`; the prefix is applied there.
 */
const authRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/otp/request',
    {
      schema: {
        tags: ['auth'],
        summary: 'Request a (dummy) OTP for a phone number',
        body: otpRequestBodySchema,
        response: { 200: okResponseSchema },
      },
    },
    async (request) => service.requestOtp(request.body),
  );

  r.post(
    '/otp/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify the dummy OTP and log in / register a consumer',
        body: otpVerifyBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => service.verifyOtp(request.body),
  );

  r.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Email + password login (staff/manager/super-admin)',
        body: loginBodySchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => service.login(request.body),
  );

  r.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate a refresh token, returning a new token pair',
        body: refreshBodySchema,
        response: { 200: tokenPairSchema },
      },
    },
    async (request) => service.refresh(request.body),
  );

  r.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a refresh token',
        body: logoutBodySchema,
        response: { 200: okResponseSchema },
      },
    },
    async (request) => service.logout(request.body),
  );

  r.get(
    '/me',
    {
      preHandler: app.requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'The currently authenticated user',
        response: { 200: userDtoSchema },
      },
    },
    async (request) => {
      if (!request.user) {
        throw new UnauthorizedError();
      }
      return service.getMe(request.user.sub);
    },
  );
};

export default authRoutes;
