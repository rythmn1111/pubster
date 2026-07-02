import { randomUUID } from 'node:crypto';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

// Seeded manager + staff (Bell in Hand); see prisma/seed.ts.
const MANAGER_EMAIL = 'manager@bellinhand.test';
const MANAGER_PASSWORD = 'ManagerPass123!';
const STAFF_EMAIL = 'staff@bellinhand.test';
const STAFF_PASSWORD = 'StaffPass123!';

// Throwaway consumer phone (deleted in teardown).
const CONSUMER_PHONE = '+19995551201';

let app: FastifyInstance;
let bellId: string; // pub A — the Bell in Hand (seeded staff/manager belong here)
let otherPubId: string; // pub B — a different pub (for cross-pub 403 checks)
let managerToken: string;
let staffToken: string;
let consumerToken: string;

// Track tables we create so teardown can restore the seeded inventory exactly.
const createdTableIds = new Set<string>();

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });
  return res.json().accessToken;
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const bell = await prisma.pub.findFirst({ where: { name: { contains: 'Bell in Hand' } } });
  const other = await prisma.pub.findFirst({
    where: { name: { not: { contains: 'Bell in Hand' } } },
  });
  if (!bell || !other) {
    throw new Error('Seed data missing: run `pnpm --filter @pubster/api prisma db seed`.');
  }
  bellId = bell.id;
  otherPubId = other.id;

  managerToken = await login(MANAGER_EMAIL, MANAGER_PASSWORD);
  staffToken = await login(STAFF_EMAIL, STAFF_PASSWORD);

  const otp = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/otp/verify',
    payload: { phone: CONSUMER_PHONE, code: '000000', name: 'Tables Tester' },
  });
  consumerToken = otp.json().accessToken;
});

afterAll(async () => {
  await app.close();
  // Restore the seeded inventory: delete only tables we created.
  await prisma.restaurantTable.deleteMany({ where: { id: { in: [...createdTableIds] } } });
  await prisma.refreshToken.deleteMany({ where: { user: { phone: CONSUMER_PHONE } } });
  await prisma.user.deleteMany({ where: { phone: CONSUMER_PHONE } });

  // Verify the pub's inventory is back to the seeded 7 tables.
  const remaining = await prisma.restaurantTable.count({ where: { pubId: bellId } });
  expect(remaining).toBe(7);

  await prisma.$disconnect();
});

describe('Tables CRUD (staff/manager)', () => {
  it('POST creates `quantity` tables of a size (201) and GET lists them', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/pubs/${bellId}/tables`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 8, label: 'Big Top', quantity: 3 },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created).toHaveLength(3);
    for (const t of created) {
      expect(t).toMatchObject({ seats: 8, label: 'Big Top', isActive: true });
      createdTableIds.add(t.id);
    }

    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/${bellId}/tables`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(list.statusCode).toBe(200);
    const tables = list.json();
    // 7 seeded + 3 created.
    expect(tables).toHaveLength(10);
    for (const t of tables) {
      expect(t).toHaveProperty('seats');
      expect(t).toHaveProperty('label');
      expect(t).toHaveProperty('isActive');
      // pubId is intentionally not exposed in the list DTO.
      expect(t).not.toHaveProperty('pubId');
    }
  });

  it('POST without quantity defaults to a single table', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/pubs/${bellId}/tables`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 10 },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ seats: 10, label: null });
    createdTableIds.add(created[0].id);
  });

  it('PATCH updates a table', async () => {
    const id = [...createdTableIds][0];
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tables/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 9, label: 'Renamed', isActive: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, seats: 9, label: 'Renamed', isActive: false });
  });

  it('DELETE hard-deletes a table (204) and reduces inventory', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/pubs/${bellId}/tables`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 12 },
    });
    const id = create.json()[0].id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tables/${id}`,
      headers: { authorization: `Bearer ${managerToken}` },
    });
    expect(del.statusCode).toBe(204);

    const gone = await prisma.restaurantTable.findUnique({ where: { id } });
    expect(gone).toBeNull();
  });

  it('404 when patching an unknown table', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tables/${randomUUID()}`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 4 },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('403 (not 404) when a manager targets a pub that is not theirs — scope precedes existence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/pubs/${randomUUID()}/tables`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: { seats: 4 },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});

describe('Tables auth / pub-scoping', () => {
  it('a consumer token cannot list tables (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/${bellId}/tables`,
      headers: { authorization: `Bearer ${consumerToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('an unauthenticated request cannot list tables (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${bellId}/tables` });
    expect(res.statusCode).toBe(401);
  });

  it('staff of pub A cannot list/create tables for pub B (403)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/${otherPubId}/tables`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(list.statusCode).toBe(403);

    const create = await app.inject({
      method: 'POST',
      url: `/api/v1/pubs/${otherPubId}/tables`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { seats: 4 },
    });
    expect(create.statusCode).toBe(403);
  });

  it('staff of pub A cannot PATCH a table belonging to pub B (403, no mutation)', async () => {
    const otherTable = await prisma.restaurantTable.findFirst({ where: { pubId: otherPubId } });
    if (!otherTable) throw new Error('expected a seeded table on pub B');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tables/${otherTable.id}`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { seats: 5 },
    });
    expect(res.statusCode).toBe(403);

    // Ensure the pub-B table was NOT modified.
    const after = await prisma.restaurantTable.findUnique({ where: { id: otherTable.id } });
    expect(after?.seats).toBe(otherTable.seats);
  });
});
