import { randomUUID } from 'node:crypto';
import { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';

// Seeded staff (Bell in Hand); see prisma/seed.ts.
const STAFF_EMAIL = 'staff@bellinhand.test';
const STAFF_PASSWORD = 'StaffPass123!';

// Throwaway consumer phones (deleted in teardown).
const CONSUMER_A_PHONE = '+19995552001';
const CONSUMER_B_PHONE = '+19995552002';

// Distinct future UTC dates so scenarios never interfere. Weekdays (2027):
// 01-04 Mon, 01-05 Tue, 01-06 Wed, 01-07 Thu, 01-08 Fri. All open at 16:00.
const SMALLEST_DATE = '2027-01-04';
const OVERBOOK_DATE = '2027-01-05';
const REFLECT_DATE = '2027-01-06';
const CONCURRENCY_DATE = '2027-01-07';
const EVENT_DATE = '2027-01-08';

/** Wall-clock 16:00 UTC on a date — a valid slot start for every seeded weekday. */
const at16 = (date: string) => `${date}T16:00:00.000Z`;

let app: FastifyInstance;
let bellId: string;
let otherPubId: string;
let staffToken: string;
let consumerAToken: string;
let consumerBToken: string;
let consumerAId: string;
let consumerBId: string;
let testEventId: string;
let otherPubEventId: string;
let sampleReservationId: string;

async function otpLogin(phone: string): Promise<{ token: string; userId: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/otp/verify',
    payload: { phone, code: '000000', name: 'Reservation Tester' },
  });
  const body = res.json();
  return { token: body.accessToken, userId: body.user.id };
}

function book(
  token: string | null,
  pubId: string,
  startTime: string,
  partyCount: number,
  eventId?: string,
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/reservations',
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
    payload: { pubId, startTime, partyCount, ...(eventId ? { eventId } : {}) },
  });
}

function availability(pubId: string, date: string, partyCount: number) {
  return app.inject({
    method: 'GET',
    url: `/api/v1/pubs/${pubId}/availability?date=${date}&partyCount=${partyCount}`,
  });
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

  // Document + assert the seeded inventory this suite reasons about.
  const inventory = await prisma.restaurantTable.groupBy({
    by: ['seats'],
    where: { pubId: bellId, isActive: true },
    _count: true,
  });
  const bySize = new Map(inventory.map((g) => [g.seats, g._count]));
  expect(bySize.get(2)).toBe(2);
  expect(bySize.get(4)).toBe(3);
  expect(bySize.get(6)).toBe(2);
  expect([...bySize.keys()].every((s) => s <= 6)).toBe(true);

  const staff = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
  });
  staffToken = staff.json().accessToken;

  ({ token: consumerAToken, userId: consumerAId } = await otpLogin(CONSUMER_A_PHONE));
  ({ token: consumerBToken, userId: consumerBId } = await otpLogin(CONSUMER_B_PHONE));

  // A controlled event on Bell for the linking tests: UTC window 16:00–18:00,
  // capacity 3 (overlaps the 16:00 slot; not the 20:00 slot).
  const event = await prisma.event.create({
    data: {
      pubId: bellId,
      name: 'Test Linking Event',
      description: null,
      startTime: new Date(`${EVENT_DATE}T16:00:00.000Z`),
      endTime: new Date(`${EVENT_DATE}T18:00:00.000Z`),
      capacity: 3,
      coverChargeCents: 1000,
      status: 'scheduled',
    },
  });
  testEventId = event.id;

  const otherEvent = await prisma.event.findFirst({ where: { pubId: otherPubId } });
  if (!otherEvent) throw new Error('expected a seeded event on pub B');
  otherPubEventId = otherEvent.id;
});

afterAll(async () => {
  await app.close();

  // Delete everything this suite created, children first.
  await prisma.reservation.deleteMany({ where: { userId: { in: [consumerAId, consumerBId] } } });
  await prisma.event.deleteMany({ where: { id: testEventId } });
  await prisma.refreshToken.deleteMany({
    where: { user: { phone: { in: [CONSUMER_A_PHONE, CONSUMER_B_PHONE] } } },
  });
  await prisma.user.deleteMany({ where: { phone: { in: [CONSUMER_A_PHONE, CONSUMER_B_PHONE] } } });

  // The seeded DB must return to Reservation count 0.
  const reservations = await prisma.reservation.count();
  expect(reservations).toBe(0);

  await prisma.$disconnect();
});

describe('GET availability', () => {
  it('generates slots from opening hours in slotMinutes (90) increments', async () => {
    const res = await availability(bellId, REFLECT_DATE, 2);
    expect(res.statusCode).toBe(200);
    const slots = res.json();
    // Wed 16:00–23:30 UTC / 90-min slots = 5 slots.
    expect(slots).toHaveLength(5);
    expect(slots[0].startTime).toBe(at16(REFLECT_DATE));
    for (let i = 0; i < slots.length; i++) {
      const start = new Date(slots[i].startTime).getTime();
      const end = new Date(slots[i].endTime).getTime();
      expect(end - start).toBe(90 * 60_000);
      if (i > 0) {
        expect(start - new Date(slots[i - 1].startTime).getTime()).toBe(90 * 60_000);
      }
      // No bookings yet on this date → available at the smallest fitting class (2).
      expect(slots[i].available).toBe(true);
      expect(slots[i].seats).toBe(2);
    }
  });

  it('party larger than the biggest table → all slots unavailable (documented)', async () => {
    const res = await availability(bellId, REFLECT_DATE, 7);
    expect(res.statusCode).toBe(200);
    const slots = res.json();
    expect(slots).toHaveLength(5);
    for (const s of slots) {
      expect(s.available).toBe(false);
      expect(s.seats).toBeNull();
    }
  });

  it('404 for an unknown pub', async () => {
    const res = await availability(randomUUID(), REFLECT_DATE, 2);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('smallest-fit size-class selection', () => {
  it('party 2 → 2-seat, party 3 → 4-seat, party 5 → 6-seat, party 7 → 409', async () => {
    const start = at16(SMALLEST_DATE);

    const p2 = await book(consumerAToken, bellId, start, 2);
    expect(p2.statusCode).toBe(201);
    expect(p2.json().seats).toBe(2);
    expect(p2.json().status).toBe('confirmed');
    expect(new Date(p2.json().endTime).getTime() - new Date(p2.json().startTime).getTime()).toBe(
      90 * 60_000,
    );
    sampleReservationId = p2.json().id;

    const p3 = await book(consumerAToken, bellId, start, 3);
    expect(p3.statusCode).toBe(201);
    expect(p3.json().seats).toBe(4);

    const p5 = await book(consumerAToken, bellId, start, 5);
    expect(p5.statusCode).toBe(201);
    expect(p5.json().seats).toBe(6);

    const p7 = await book(consumerAToken, bellId, start, 7);
    expect(p7.statusCode).toBe(409);
    expect(p7.json().error.code).toBe('CONFLICT');
  });
});

describe('overbooking escalation (smallest class WITH free capacity)', () => {
  it('party-of-2 bookings escalate 2→4→6 as classes fill, then 409', async () => {
    const start = at16(OVERBOOK_DATE);
    const seatsChosen: number[] = [];

    // 7 tables total (2×2 + 3×4 + 2×6): 7 successful party-2 bookings.
    for (let i = 0; i < 7; i++) {
      const res = await book(consumerAToken, bellId, start, 2);
      expect(res.statusCode).toBe(201);
      seatsChosen.push(res.json().seats);
    }
    // First two consume the 2-seat class, next three the 4-seat, last two the 6-seat.
    expect(seatsChosen).toEqual([2, 2, 4, 4, 4, 6, 6]);

    // All 7 tables now held for this slot → the 8th booking is refused.
    const overflow = await book(consumerAToken, bellId, start, 2);
    expect(overflow.statusCode).toBe(409);
    expect(overflow.json().error.code).toBe('CONFLICT');
  });
});

describe('availability reflects bookings + cancel frees capacity', () => {
  it('exhausting the 6-seat class hides the slot; cancelling re-opens it', async () => {
    const start = at16(REFLECT_DATE);

    // Consume both 6-seat tables with party-of-6 bookings.
    const b1 = await book(consumerAToken, bellId, start, 6);
    const b2 = await book(consumerBToken, bellId, start, 6);
    expect(b1.statusCode).toBe(201);
    expect(b2.statusCode).toBe(201);
    const cancelId = b1.json().id;

    // The 16:00 slot is now unavailable for a party of 6.
    let slots = (await availability(bellId, REFLECT_DATE, 6)).json();
    let slot = slots.find((s: { startTime: string }) => s.startTime === start);
    expect(slot.available).toBe(false);
    expect(slot.seats).toBeNull();

    // Owner cancels one booking → the slot frees up again.
    const cancel = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${cancelId}/cancel`,
      headers: { authorization: `Bearer ${consumerAToken}` },
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().status).toBe('cancelled');

    slots = (await availability(bellId, REFLECT_DATE, 6)).json();
    slot = slots.find((s: { startTime: string }) => s.startTime === start);
    expect(slot.available).toBe(true);
    expect(slot.seats).toBe(6);
  });
});

describe('CONCURRENCY: last table in a slot', () => {
  it('two simultaneous bookings for the last table → exactly one succeeds', async () => {
    const start = at16(CONCURRENCY_DATE);

    // Consume one of the two 6-seat tables so exactly one remains.
    const first = await book(consumerAToken, bellId, start, 6);
    expect(first.statusCode).toBe(201);

    // Fire two concurrent party-6 bookings for that last 6-seat table.
    const [r1, r2] = await Promise.all([
      book(consumerAToken, bellId, start, 6),
      book(consumerBToken, bellId, start, 6),
    ]);
    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([201, 409]);
    const loser = [r1, r2].find((r) => r.statusCode === 409)!;
    expect(loser.json().error.code).toBe('CONFLICT');

    // Exactly two confirmed party-6 bookings exist for the slot (both 6-seats).
    const held = await prisma.reservation.count({
      where: { pubId: bellId, startTime: new Date(start), status: 'confirmed' },
    });
    expect(held).toBe(2);
  });
});

describe('event linking (Phase-2 cover NOT charged here)', () => {
  it('links an overlapping event, then rejects at capacity (409)', async () => {
    const start = at16(EVENT_DATE); // 16:00–17:30 overlaps the 16:00–18:00 event

    const linked = await book(consumerAToken, bellId, start, 2, testEventId);
    expect(linked.statusCode).toBe(201);
    expect(linked.json().eventId).toBe(testEventId);

    // capacity 3, already 2 joined → a second party of 2 (=4) exceeds it.
    const over = await book(consumerBToken, bellId, start, 2, testEventId);
    expect(over.statusCode).toBe(409);
    expect(over.json().error.code).toBe('CONFLICT');
  });

  it('rejects a non-overlapping event window (400)', async () => {
    const nonOverlap = `${EVENT_DATE}T20:00:00.000Z`; // event ends 18:00
    const res = await book(consumerAToken, bellId, nonOverlap, 2, testEventId);
    expect(res.statusCode).toBe(400);
  });

  it('rejects an event from another pub (400) and an unknown event (404)', async () => {
    const start = at16(EVENT_DATE);
    const wrongPub = await book(consumerAToken, bellId, start, 2, otherPubEventId);
    expect(wrongPub.statusCode).toBe(400);

    const unknown = await book(consumerAToken, bellId, start, 2, randomUUID());
    expect(unknown.statusCode).toBe(404);
  });
});

describe('reservations/me + cancel ownership', () => {
  it('GET /reservations/me returns the caller’s reservations with pub name, newest first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reservations/me',
      headers: { authorization: `Bearer ${consumerAToken}` },
    });
    expect(res.statusCode).toBe(200);
    const mine = res.json();
    expect(mine.length).toBeGreaterThan(0);
    for (const r of mine) {
      expect(r.userId).toBe(consumerAId);
      expect(r.pubName).toBeTruthy();
    }
    // Ordered by startTime descending.
    for (let i = 1; i < mine.length; i++) {
      expect(new Date(mine[i - 1].startTime).getTime()).toBeGreaterThanOrEqual(
        new Date(mine[i].startTime).getTime(),
      );
    }
  });

  it('a consumer cannot cancel someone else’s reservation (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${sampleReservationId}/cancel`,
      headers: { authorization: `Bearer ${consumerBToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('cancelling an unknown reservation → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${randomUUID()}/cancel`,
      headers: { authorization: `Bearer ${consumerAToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('unauthenticated booking → 401', async () => {
    const res = await book(null, bellId, at16(SMALLEST_DATE), 2);
    expect(res.statusCode).toBe(401);
  });
});

describe('staff reservation management (pub-scoped)', () => {
  it('GET /pubs/:id/reservations lists a pub/date for staff', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/${bellId}/reservations?date=${OVERBOOK_DATE}`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    // The overbooking scenario booked 7 reservations on this date.
    expect(list).toHaveLength(7);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i].startTime).getTime()).toBeGreaterThanOrEqual(
        new Date(list[i - 1].startTime).getTime(),
      );
    }
  });

  it('staff of pub A cannot list pub B reservations (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/pubs/${otherPubId}/reservations?date=${OVERBOOK_DATE}`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('staff can transition a reservation status (seated)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${sampleReservationId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { status: 'seated' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('seated');
  });

  it('a consumer cannot set reservation status (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${sampleReservationId}/status`,
      headers: { authorization: `Bearer ${consumerAToken}` },
      payload: { status: 'completed' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('an invalid status value → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reservations/${sampleReservationId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { status: 'cancelled' },
    });
    expect(res.statusCode).toBe(400);
  });
});
