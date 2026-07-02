import { randomUUID } from 'node:crypto';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

// Test query point: downtown Boston (matches the seeded pub cluster).
const LAT = 42.3601;
const LNG = -71.0589;

let app: FastifyInstance;
let bellId: string; // The Bell in Hand Tavern — the closest seeded pub.

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  const bell = await prisma.pub.findFirst({ where: { name: { contains: 'Bell in Hand' } } });
  if (!bell) {
    throw new Error('Seed data missing: run `pnpm --filter @pubster/api prisma db seed`.');
  }
  bellId = bell.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

// These are read-only tests — they create no data, so no cleanup is required.

describe('GET /api/v1/pubs/nearest', () => {
  it('returns all seeded pubs ordered by ascending distance (Bell in Hand first ~157m)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/nearest?lat=${LAT}&lng=${LNG}`,
    });
    expect(res.statusCode).toBe(200);

    const pubs = res.json();
    expect(pubs).toHaveLength(4);

    // Closest pub is The Bell in Hand Tavern, ~157m away.
    expect(pubs[0].name).toContain('Bell in Hand');
    expect(pubs[0].distanceMeters).toBeGreaterThan(100);
    expect(pubs[0].distanceMeters).toBeLessThan(250);

    // Distances are non-decreasing (ordered ASC).
    for (let i = 1; i < pubs.length; i++) {
      expect(pubs[i].distanceMeters).toBeGreaterThanOrEqual(pubs[i - 1].distanceMeters);
    }

    // distanceMeters is a rounded integer; the raw PostGIS blob is not exposed.
    expect(Number.isInteger(pubs[0].distanceMeters)).toBe(true);
    expect(pubs[0]).not.toHaveProperty('location');
    expect(pubs[0]).toMatchObject({ id: expect.any(String), latitude: expect.any(Number) });

    console.log(
      'nearest ordering:',
      pubs.map((p: { name: string; distanceMeters: number }) => `${p.name}=${p.distanceMeters}m`),
    );
  });

  it('respects a tiny radius (300m) — only the closest 1–2 pubs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/nearest?lat=${LAT}&lng=${LNG}&radius=300`,
    });
    expect(res.statusCode).toBe(200);

    const pubs = res.json();
    expect(pubs.length).toBeGreaterThanOrEqual(1);
    expect(pubs.length).toBeLessThanOrEqual(2);
    expect(pubs[0].name).toContain('Bell in Hand');
    for (const p of pubs) {
      expect(p.distanceMeters).toBeLessThanOrEqual(300);
    }
  });

  it('respects the limit param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/nearest?lat=${LAT}&lng=${LNG}&limit=2`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });

  it('returns 400 when lat/lng are missing', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/nearest?lng=${LNG}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/pubs/:id', () => {
  it('returns the expected detail fields for a seeded pub', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${bellId}` });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body).toMatchObject({
      id: bellId,
      slotMinutes: 90,
      city: 'Boston',
      region: 'MA',
    });
    expect(body.name).toContain('Bell in Hand');
    expect(typeof body.latitude).toBe('number');
    expect(typeof body.longitude).toBe('number');
    expect(Array.isArray(body.photos)).toBe(true);
    expect(body).toHaveProperty('openingHours');
    expect(body).toHaveProperty('phone');
    // The raw PostGIS blob is never exposed.
    expect(body).not.toHaveProperty('location');
  });

  it('returns 404 with the canonical error envelope for an unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${randomUUID()}` });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });
});

describe('GET /api/v1/pubs/:id/menu', () => {
  it('returns categories (with items) ordered by sortOrder', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${bellId}/menu` });
    expect(res.statusCode).toBe(200);

    const categories = res.json();
    expect(categories.length).toBeGreaterThan(0);

    // Categories ordered by sortOrder ascending.
    const catOrders = categories.map((c: { sortOrder: number }) => c.sortOrder);
    expect(catOrders).toEqual([...catOrders].sort((a, b) => a - b));

    for (const category of categories) {
      expect(category.items.length).toBeGreaterThan(0);
      // Items ordered by sortOrder ascending, and expose availability.
      const itemOrders = category.items.map((i: { sortOrder: number }) => i.sortOrder);
      expect(itemOrders).toEqual([...itemOrders].sort((a, b) => a - b));
      for (const item of category.items) {
        expect(item).toHaveProperty('isAvailable');
        expect(typeof item.priceCents).toBe('number');
        expect(item.categoryId).toBe(category.id);
      }
    }
  });

  it('returns 404 for the menu of an unknown pub', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${randomUUID()}/menu` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/pubs/:id/events', () => {
  it('returns upcoming scheduled events, all with a future startTime', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${bellId}/events` });
    expect(res.statusCode).toBe(200);

    const events = res.json();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const now = Date.now();
    let previous = 0;
    for (const event of events) {
      const start = new Date(event.startTime).getTime();
      expect(start).toBeGreaterThanOrEqual(now);
      expect(start).toBeGreaterThanOrEqual(previous); // ordered ASC
      previous = start;
      expect(event).toHaveProperty('coverChargeCents');
      expect(event).toHaveProperty('capacity');
    }
  });

  it('returns 404 for the events of an unknown pub', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/pubs/${randomUUID()}/events` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
