import { z } from 'zod';
import type {
  AvailabilitySlotDTO,
  CreateReservationRequest,
  ReservationDTO,
  UpdateReservationStatusRequest,
} from '@pubster/shared';

/**
 * zod request/response schemas for the reservations module (docs/BACKEND.md
 * §API surface, docs/DATABASE.md §Availability logic). Request schemas validate
 * input (→ 400); response schemas double as OpenAPI docs and are kept in sync
 * with the shared DTOs via the `satisfies`-style contract assertions below.
 */

// --- Request params / querystrings / bodies ---------------------------------

/** `:id` path param (pub id). */
export const pubIdParamsSchema = z.object({
  id: z.uuid(),
});

/** `:id` path param (reservation id). */
export const reservationIdParamsSchema = z.object({
  id: z.uuid(),
});

/** `GET /pubs/:id/availability?date=YYYY-MM-DD&partyCount=N`. */
export const availabilityQuerySchema = z.object({
  date: z.iso.date(),
  partyCount: z.coerce.number().int().min(1).max(100),
});

/** `GET /pubs/:id/reservations?date=YYYY-MM-DD` (staff/manager). */
export const pubReservationsQuerySchema = z.object({
  date: z.iso.date(),
});

/** `POST /reservations` body. */
export const createReservationBodySchema = z.object({
  pubId: z.uuid(),
  startTime: z.iso.datetime({ offset: true }),
  partyCount: z.number().int().min(1).max(100),
  eventId: z.uuid().optional(),
});

/** `POST /reservations/:id/status` body — staff may set these transitions. */
export const updateStatusBodySchema = z.object({
  status: z.enum(['seated', 'completed', 'no_show']),
});

// --- Responses --------------------------------------------------------------

export const availabilitySlotDtoSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  available: z.boolean(),
  seats: z.number().int().nullable(),
});

export const availabilityListSchema = z.array(availabilitySlotDtoSchema);

export const reservationDtoSchema = z.object({
  id: z.string(),
  pubId: z.string(),
  pubName: z.string().nullable(),
  userId: z.string(),
  partyCount: z.number().int(),
  seats: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']),
  eventId: z.string().nullable(),
  createdAt: z.string(),
});

export const reservationListSchema = z.array(reservationDtoSchema);

// --- Contract checks: schemas must match the shared DTOs --------------------

type _AssertSlot =
  z.infer<typeof availabilitySlotDtoSchema> extends AvailabilitySlotDTO ? true : never;
type _AssertReservation =
  z.infer<typeof reservationDtoSchema> extends ReservationDTO ? true : never;
type _AssertCreate =
  z.infer<typeof createReservationBodySchema> extends CreateReservationRequest ? true : never;
type _AssertStatus =
  z.infer<typeof updateStatusBodySchema> extends UpdateReservationStatusRequest ? true : never;

const _contracts: [_AssertSlot, _AssertReservation, _AssertCreate, _AssertStatus] = [
  true,
  true,
  true,
  true,
];
void _contracts;
