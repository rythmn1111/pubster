import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { UserRole } from '@pubster/shared';
import { verifyAccessToken, type AccessTokenClaims } from '../lib/jwt.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

// Augment Fastify with the authenticated user and the role guard factory.
declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenClaims | null;
  }
  interface FastifyInstance {
    /** Build a preHandler that requires the caller to hold one of `roles`. */
    requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
  }
}

/**
 * Auth plugin (skeleton).
 *
 * Decorates the instance with `requireRole(...roles)` and the request with
 * `user`. Token issuance/refresh, dummy-OTP consumer login, and pub-scoping
 * land with the auth module (docs/BACKEND.md §Auth design).
 */
export default fp(
  async (app) => {
    app.decorateRequest('user', null);

    app.decorate('requireRole', (...roles: UserRole[]): preHandlerHookHandler => {
      return async (request: FastifyRequest, _reply: FastifyReply) => {
        const header = request.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
          throw new UnauthorizedError('Missing or malformed Authorization header');
        }

        const claims = verifyAccessToken(header.slice('Bearer '.length));
        request.user = claims;

        if (roles.length > 0 && !roles.includes(claims.role)) {
          throw new ForbiddenError('Insufficient role');
        }
      };
    });
  },
  { name: 'auth' },
);
