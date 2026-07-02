import { z } from 'zod';
import type { EventDTO, PubDetailDTO, PubSummaryDTO } from '@pubster/shared';

/**
 * zod request/response schemas for the pubs module (docs/BACKEND.md §API surface).
 * Request schemas validate input (→ 400); response schemas double as OpenAPI docs
 * and are kept structurally in sync with the shared DTOs via the `satisfies`-style
 * contract assertions below (mirrors the auth module).
 */

// --- Request params / querystrings -----------------------------------------

/** `GET /pubs/nearest` query: lat/lng required, radius/limit optional. */
export const nearestPubsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50_000).default(5_000),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** `:id` path param for pub-scoped routes. */
export const pubIdParamsSchema = z.object({
  id: z.uuid(),
});

// --- Responses --------------------------------------------------------------

export const pubSummaryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  photos: z.array(z.string()),
  distanceMeters: z.number(),
});

/** Opening hours JSON: weekday key → list of `[open, close]` string ranges. */
export const openingHoursSchema = z.record(z.string(), z.array(z.array(z.string())));

export const pubDetailDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  phone: z.string().nullable(),
  photos: z.array(z.string()),
  openingHours: openingHoursSchema.nullable(),
  slotMinutes: z.number().int(),
});

export const eventDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  capacity: z.number().int(),
  coverChargeCents: z.number().int(),
});

export const pubSummaryListSchema = z.array(pubSummaryDtoSchema);
export const eventListSchema = z.array(eventDtoSchema);

// --- Contract checks: schemas must match the shared DTOs --------------------

type _AssertPubSummary = z.infer<typeof pubSummaryDtoSchema> extends PubSummaryDTO ? true : never;
type _AssertPubDetail = z.infer<typeof pubDetailDtoSchema> extends PubDetailDTO ? true : never;
type _AssertEvent = z.infer<typeof eventDtoSchema> extends EventDTO ? true : never;

const _contracts: [_AssertPubSummary, _AssertPubDetail, _AssertEvent] = [true, true, true];
void _contracts;
