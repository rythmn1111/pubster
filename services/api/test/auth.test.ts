import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt.js';
import authPlugin from '../src/plugins/auth.js';
import errorHandlerPlugin from '../src/plugins/errorHandler.js';

// Seeded manager credentials (see prisma/seed.ts).
const MANAGER_EMAIL = 'manager@bellinhand.test';
const MANAGER_PASSWORD = 'ManagerPass123!';

// Throwaway consumer phones (deleted in teardown so dev data stays clean).
const CONSUMER_PHONE = '+19995550123';
const WRONG_CODE_PHONE = '+19995550124';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  // Clean up everything these tests created in the shared dev DB.
  await prisma.refreshToken.deleteMany({
    where: { user: { email: MANAGER_EMAIL } },
  });
  await prisma.user.deleteMany({ where: { phone: { startsWith: '+1999' } } });
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/otp/request', () => {
  it('returns { ok: true } (dummy, no SMS)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { phone: CONSUMER_PHONE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('POST /api/v1/auth/otp/verify', () => {
  it('with the dummy code creates a REAL consumer + returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { phone: CONSUMER_PHONE, code: '000000' },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.user).toMatchObject({ role: 'consumer', phone: CONSUMER_PHONE });

    // The user row is really persisted (only SMS is stubbed).
    const dbUser = await prisma.user.findUnique({ where: { phone: CONSUMER_PHONE } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.role).toBe('consumer');
    expect(dbUser?.id).toBe(body.user.id);

    // The access token carries the consumer claims.
    const claims = verifyAccessToken(body.accessToken);
    expect(claims.sub).toBe(dbUser?.id);
    expect(claims.role).toBe('consumer');
  });

  it('with a wrong code returns 401 and creates no user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { phone: WRONG_CODE_PHONE, code: '111111' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');

    const dbUser = await prisma.user.findUnique({ where: { phone: WRONG_CODE_PHONE } });
    expect(dbUser).toBeNull();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in the seeded manager and returns a manager-role token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.user.role).toBe('manager');
    expect(body.user.email).toBe(MANAGER_EMAIL);

    const claims = verifyAccessToken(body.accessToken);
    expect(claims.role).toBe('manager');
    expect(claims.pubId).toBeTruthy(); // manager tokens are pub-scoped
  });

  it('rejects a wrong password with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: MANAGER_EMAIL, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /api/v1/auth/refresh (rotation)', () => {
  it('rotates: new pair works, the OLD refresh token is rejected', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD },
    });
    const oldRefresh: string = login.json().refreshToken;

    // Rotate.
    const rotate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldRefresh },
    });
    expect(rotate.statusCode).toBe(200);
    const newPair = rotate.json();
    expect(typeof newPair.accessToken).toBe('string');
    expect(newPair.refreshToken).not.toBe(oldRefresh);

    // The NEW access token is valid.
    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${newPair.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().role).toBe('manager');

    // The NEW refresh token can rotate again.
    const rotateAgain = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: newPair.refreshToken },
    });
    expect(rotateAgain.statusCode).toBe(200);

    // The OLD refresh token is now rejected.
    const reuseOld = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldRefresh },
    });
    expect(reuseOld.statusCode).toBe(401);
  });

  it('revokes a refresh token on logout', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD },
    });
    const refreshToken: string = login.json().refreshToken;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });

    // The revoked token can no longer be refreshed.
    const rotate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(rotate.statusCode).toBe(401);
  });
});

describe('GET /api/v1/auth/me (requireAuth)', () => {
  it('returns the right user for a valid access token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD },
    });
    const accessToken: string = login.json().accessToken;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ role: 'manager', email: MANAGER_EMAIL });
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireRole guard', () => {
  let guarded: FastifyInstance;

  beforeAll(async () => {
    guarded = Fastify({ logger: false });
    await guarded.register(errorHandlerPlugin);
    await guarded.register(authPlugin);
    guarded.get('/manager-only', { preHandler: guarded.requireRole('manager') }, async () => ({
      ok: true,
    }));
    await guarded.ready();
  });

  afterAll(async () => {
    await guarded.close();
  });

  it('lets a manager token through (200)', async () => {
    const token = signAccessToken({ sub: 'test-manager', role: 'manager', pubId: 'pub-1' });
    const res = await guarded.inject({
      method: 'GET',
      url: '/manager-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('blocks a consumer token with 403', async () => {
    const token = signAccessToken({ sub: 'test-consumer', role: 'consumer' });
    const res = await guarded.inject({
      method: 'GET',
      url: '/manager-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('blocks a missing token with 401', async () => {
    const res = await guarded.inject({ method: 'GET', url: '/manager-only' });
    expect(res.statusCode).toBe(401);
  });
});
