import fp from 'fastify-plugin';
import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { UserRole } from '@pubster/shared';
import { verifyAccessToken, type AccessTokenClaims } from '../lib/jwt.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

// Augment Fastify with the authenticated user and the auth guards.
declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenClaims | null;
  }
  interface FastifyInstance {
    /** preHandler: require a valid Bearer access token; sets `request.user`. */
    requireAuth: preHandlerHookHandler;
    /** Build a preHandler that requires a valid token holding one of `roles`. */
    requireRole: (...roles: UserRole[]) => preHandlerHookHandler;
  }
}

/**
 * Verify the Bearer access token on a request and stash the claims on
 * `request.user`. Throws {@link UnauthorizedError} when absent/malformed/invalid.
 */
function authenticate(request: FastifyRequest): AccessTokenClaims {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  let claims: AccessTokenClaims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  request.user = claims;
  return claims;
}

/**
 * Pub-scoping guard for pub-owned resources: a `super_admin` may touch any pub;
 * everyone else must carry a token whose `pubId` matches the target pub.
 * Throws {@link ForbiddenError} on mismatch. (Used by pub-scoped modules.)
 */
export function assertPubScope(user: AccessTokenClaims, pubId: string): void {
  if (user.role === 'super_admin') {
    return;
  }
  if (!user.pubId || user.pubId !== pubId) {
    throw new ForbiddenError('Resource belongs to a different pub');
  }
}

/**
 * Auth plugin.
 *
 * Decorates the request with `user` and the instance with `requireAuth`
 * (any authenticated caller) and `requireRole(...roles)` (role-gated). Token
 * issuance / rotation / dummy-OTP login live in the auth module
 * (see `modules/auth` + docs/BACKEND.md §Auth design).
 */
export default fp(
  async (app) => {
    app.decorateRequest('user', null);

    const requireAuth: preHandlerHookHandler = async (request) => {
      authenticate(request);
    };
    app.decorate('requireAuth', requireAuth);

    app.decorate('requireRole', (...roles: UserRole[]): preHandlerHookHandler => {
      return async (request) => {
        const claims = authenticate(request);
        if (roles.length > 0 && !roles.includes(claims.role)) {
          throw new ForbiddenError('Insufficient role');
        }
      };
    });
  },
  { name: 'auth' },
);
