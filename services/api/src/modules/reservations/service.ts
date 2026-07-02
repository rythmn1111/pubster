import type { Prisma, Reservation } from '@prisma/client';
import type {
  AvailabilitySlotDTO,
  CreateReservationRequest,
  OpeningHours,
  ReservationDTO,
  ReservationStatus,
  UpdateReservationStatusRequest,
} from '@pubster/shared';
import { prisma } from '../../db/prisma.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';

/**
 * Reservations business logic — availability + race-safe booking, cancel, and
 * staff management (docs/BACKEND.md §API surface, docs/DATABASE.md §Availability
 * logic). Reservations grab a table SIZE CLASS from the pool (never a specific
 * table row); a plain table reservation is FREE (event cover is Phase 2).
 *
 * TIMEZONE ASSUMPTION (MVP, single fixed choice — kept identical between slot
 * generation and overlap checks): a pub's `openingHours` wall-clock "HH:MM"
 * times are interpreted as UTC, and the `date=YYYY-MM-DD` query param denotes a
 * UTC calendar date (weekday derived via `getUTCDay`). A slot for `date` at
 * `HH:MM` therefore maps to the instant `Date.UTC(date) + HH*60+MM minutes`.
 * Reservations are stored as absolute UTC timestamps, so overlap comparisons
 * are consistent. A production build would store each pub's IANA timezone and
 * convert wall-clock hours in that zone; that is deliberately out of scope here.
 */

/** Reservation statuses that HOLD a table (consume availability). */
const HOLDING_STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'seated'];

/** Weekday keys used in `openingHours`, indexed by `Date#getUTCDay()` (0 = sun). */
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Any client that can run the queries below (the base client or a tx client). */
type DbClient = Prisma.TransactionClient;

/** Parse `"HH:MM"` to minutes-from-midnight, or `null` if malformed. */
function toMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 47 || minutes > 59) return null;
  return hours * 60 + minutes;
}

interface Slot {
  start: Date;
  end: Date;
}

/**
 * Generate candidate slots for `dateStr` from `openingHours` in `slotMinutes`
 * increments. A slot fits only when `start + slotMinutes <= close`. Ranges that
 * close at/after midnight (close <= open) are treated as closing the next day.
 */
function generateSlots(
  dateStr: string,
  openingHours: OpeningHours | null,
  slotMinutes: number,
): Slot[] {
  const [year, month, day] = dateStr.split('-').map(Number);
  const baseUtcMs = Date.UTC(year, month - 1, day);
  const weekday = WEEKDAYS[new Date(baseUtcMs).getUTCDay()];
  const ranges = openingHours?.[weekday] ?? [];

  const slots: Slot[] = [];
  for (const range of ranges) {
    if (!Array.isArray(range) || range.length < 2) continue;
    const open = toMinutes(range[0]);
    let close = toMinutes(range[1]);
    if (open === null || close === null) continue;
    if (close <= open) close += 24 * 60; // range crosses midnight

    for (let startMin = open; startMin + slotMinutes <= close; startMin += slotMinutes) {
      slots.push({
        start: new Date(baseUtcMs + startMin * 60_000),
        end: new Date(baseUtcMs + (startMin + slotMinutes) * 60_000),
      });
    }
  }
  return slots;
}

/** Count of ACTIVE tables per seat size for a pub → `Map<seats, count>`. */
async function activeTableCounts(client: DbClient, pubId: string): Promise<Map<number, number>> {
  const groups = await client.restaurantTable.groupBy({
    by: ['seats'],
    where: { pubId, isActive: true },
    _count: true,
  });
  return new Map(groups.map((g) => [g.seats, g._count]));
}

/**
 * Pick the smallest table size class that can seat `partyCount` and has free
 * capacity for `[slotStart, slotEnd)` (DATABASE.md algorithm). Returns the size
 * class, or `null` when no class fits/has capacity. Queries live counts on the
 * given client so callers under an advisory lock see a race-safe view.
 */
async function pickAvailableSizeClass(
  client: DbClient,
  pubId: string,
  slotStart: Date,
  slotEnd: Date,
  partyCount: number,
): Promise<number | null> {
  const tableCounts = await activeTableCounts(client, pubId);
  const classes = [...tableCounts.keys()].filter((s) => s >= partyCount).sort((a, b) => a - b);

  for (const seats of classes) {
    const held = await client.reservation.count({
      where: {
        pubId,
        seats,
        status: { in: HOLDING_STATUSES },
        // [reservation) overlaps [slot): start < slotEnd AND end > slotStart.
        startTime: { lt: slotEnd },
        endTime: { gt: slotStart },
      },
    });
    const free = (tableCounts.get(seats) ?? 0) - held;
    if (free > 0) return seats;
  }
  return null;
}

/** Map a Prisma `Reservation` (+ pub name) to the wire {@link ReservationDTO}. */
function toReservationDTO(res: Reservation, pubName: string | null): ReservationDTO {
  return {
    id: res.id,
    pubId: res.pubId,
    pubName,
    userId: res.userId,
    partyCount: res.partyCount,
    seats: res.seats,
    startTime: res.startTime.toISOString(),
    endTime: res.endTime.toISOString(),
    status: res.status,
    eventId: res.eventId,
    createdAt: res.createdAt.toISOString(),
  };
}

/**
 * `GET /pubs/:id/availability` — candidate slots for `dateStr`, each annotated
 * with availability for `partyCount` and the size class that would be consumed.
 * When `partyCount` exceeds every table size no class can fit, so every slot is
 * returned with `available: false` / `seats: null` (documented behaviour). If
 * the pub is closed that weekday the slot list is empty.
 */
export async function getAvailability(
  pubId: string,
  dateStr: string,
  partyCount: number,
): Promise<AvailabilitySlotDTO[]> {
  const pub = await prisma.pub.findUnique({
    where: { id: pubId },
    select: { slotMinutes: true, openingHours: true },
  });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }

  const slots = generateSlots(
    dateStr,
    (pub.openingHours as OpeningHours | null) ?? null,
    pub.slotMinutes,
  );
  if (slots.length === 0) {
    return [];
  }

  const tableCounts = await activeTableCounts(prisma, pubId);
  const classesForParty = [...tableCounts.keys()]
    .filter((s) => s >= partyCount)
    .sort((a, b) => a - b);

  const windowStart = slots[0].start;
  const windowEnd = slots[slots.length - 1].end;
  const held = await prisma.reservation.findMany({
    where: {
      pubId,
      status: { in: HOLDING_STATUSES },
      startTime: { lt: windowEnd },
      endTime: { gt: windowStart },
    },
    select: { startTime: true, endTime: true, seats: true },
  });

  return slots.map((slot) => {
    let chosen: number | null = null;
    for (const seats of classesForParty) {
      const overlapping = held.filter(
        (r) => r.seats === seats && r.startTime < slot.end && r.endTime > slot.start,
      ).length;
      if ((tableCounts.get(seats) ?? 0) - overlapping > 0) {
        chosen = seats;
        break;
      }
    }
    return {
      startTime: slot.start.toISOString(),
      endTime: slot.end.toISOString(),
      available: chosen !== null,
      seats: chosen,
    };
  });
}

/**
 * `POST /reservations` — RACE-SAFE booking. Inside a single transaction we take
 * a per-pub advisory lock (held until commit) BEFORE re-checking availability,
 * so two concurrent bookings for the last table serialise and exactly one wins.
 * Picks the smallest available size class >= partyCount, stores it on `seats`,
 * sets `endTime = start + slotMinutes` and `status = confirmed`. Optional
 * `eventId` is validated + linked (belongs to pub, window overlaps, not at
 * capacity) but cover charging is Phase 2 (NOT applied here).
 */
export async function createReservation(
  userId: string,
  body: CreateReservationRequest,
): Promise<ReservationDTO> {
  const startTime = new Date(body.startTime);
  if (Number.isNaN(startTime.getTime())) {
    throw new BadRequestError('Invalid startTime');
  }

  return prisma.$transaction(async (tx) => {
    // Per-pub advisory lock — serialises concurrent bookings for this pub so the
    // availability re-check below is race-safe. Released automatically on commit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${body.pubId}, 0))`;

    const pub = await tx.pub.findUnique({
      where: { id: body.pubId },
      select: { id: true, name: true, slotMinutes: true },
    });
    if (!pub) {
      throw new NotFoundError('Pub not found');
    }

    const endTime = new Date(startTime.getTime() + pub.slotMinutes * 60_000);

    // Optional event linkage (Phase-2 cover charge NOT computed/charged here).
    if (body.eventId) {
      const event = await tx.event.findUnique({
        where: { id: body.eventId },
        select: { id: true, pubId: true, startTime: true, endTime: true, capacity: true },
      });
      if (!event) {
        throw new NotFoundError('Event not found');
      }
      if (event.pubId !== body.pubId) {
        throw new BadRequestError('Event does not belong to this pub');
      }
      const overlaps = event.startTime < endTime && event.endTime > startTime;
      if (!overlaps) {
        throw new BadRequestError('Event does not overlap the reservation slot');
      }
      const joined = await tx.reservation.aggregate({
        where: { eventId: event.id, status: { not: 'cancelled' } },
        _sum: { partyCount: true },
      });
      const current = joined._sum.partyCount ?? 0;
      if (current + body.partyCount > event.capacity) {
        throw new ConflictError('Event is at capacity');
      }
    }

    const seats = await pickAvailableSizeClass(tx, body.pubId, startTime, endTime, body.partyCount);
    if (seats === null) {
      throw new ConflictError('No table available for this slot and party size');
    }

    const created = await tx.reservation.create({
      data: {
        pubId: body.pubId,
        userId,
        partyCount: body.partyCount,
        seats,
        startTime,
        endTime,
        status: 'confirmed',
        eventId: body.eventId ?? null,
      },
    });
    return toReservationDTO(created, pub.name);
  });
}

/**
 * `GET /reservations/me` — the caller's reservations (upcoming + past), pub name
 * included, most recent first.
 */
export async function getMyReservations(userId: string): Promise<ReservationDTO[]> {
  const reservations = await prisma.reservation.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    include: { pub: { select: { name: true } } },
  });
  return reservations.map((r) => toReservationDTO(r, r.pub.name));
}

/**
 * `POST /reservations/:id/cancel` — owner-only cancel (frees the slot). 404 if
 * unknown, 403 if it belongs to another user. Idempotent for already-cancelled.
 */
export async function cancelReservation(
  userId: string,
  reservationId: string,
): Promise<ReservationDTO> {
  const existing = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { pub: { select: { name: true } } },
  });
  if (!existing) {
    throw new NotFoundError('Reservation not found');
  }
  if (existing.userId !== userId) {
    throw new ForbiddenError('Not your reservation');
  }
  if (existing.status === 'cancelled') {
    return toReservationDTO(existing, existing.pub.name);
  }
  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: 'cancelled' },
    include: { pub: { select: { name: true } } },
  });
  return toReservationDTO(updated, updated.pub.name);
}

/**
 * `GET /pubs/:id/reservations?date` — all reservations for a pub whose start
 * falls on `dateStr` (UTC day), ordered by start ascending. Staff/manager.
 */
export async function listPubReservations(
  pubId: string,
  dateStr: string,
): Promise<ReservationDTO[]> {
  const pub = await prisma.pub.findUnique({ where: { id: pubId }, select: { name: true } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const reservations = await prisma.reservation.findMany({
    where: { pubId, startTime: { gte: dayStart, lt: dayEnd } },
    orderBy: { startTime: 'asc' },
  });
  return reservations.map((r) => toReservationDTO(r, pub.name));
}

/** Resolve a reservation's `pubId` (for pub-scoping the status route). 404 if unknown. */
export async function getReservationPubId(reservationId: string): Promise<string> {
  const res = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { pubId: true },
  });
  if (!res) {
    throw new NotFoundError('Reservation not found');
  }
  return res.pubId;
}

/**
 * `POST /reservations/:id/status` — staff/manager transition to
 * seated/completed/no_show (pub scope asserted by the route).
 */
export async function setReservationStatus(
  reservationId: string,
  body: UpdateReservationStatusRequest,
): Promise<ReservationDTO> {
  const updated = await prisma.reservation.update({
    where: { id: reservationId },
    data: { status: body.status },
    include: { pub: { select: { name: true } } },
  });
  return toReservationDTO(updated, updated.pub.name);
}
