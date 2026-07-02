import type { EventDTO, OpeningHours, PubDetailDTO, PubSummaryDTO } from '@pubster/shared';
import { prisma } from '../../db/prisma.js';
import { findNearestPubs, type NearestPubsParams } from '../../lib/geo.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Pubs business logic (docs/BACKEND.md §API surface). All reads are PUBLIC:
 * nearest (PostGIS), pub detail, and upcoming events. The raw PostGIS `location`
 * column is never exposed in a response.
 */

/**
 * `GET /pubs/nearest` — pubs within `radiusMeters` of the query point, ordered
 * by ascending distance. Delegates the geography query to {@link findNearestPubs}.
 */
export function getNearestPubs(params: NearestPubsParams): Promise<PubSummaryDTO[]> {
  return findNearestPubs(params);
}

/** `GET /pubs/:id` — pub detail; 404 if no pub with that id exists. */
export async function getPubDetail(id: string): Promise<PubDetailDTO> {
  const pub = await prisma.pub.findUnique({ where: { id } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }
  return {
    id: pub.id,
    name: pub.name,
    description: pub.description,
    latitude: pub.latitude,
    longitude: pub.longitude,
    addressLine: pub.addressLine,
    city: pub.city,
    region: pub.region,
    postalCode: pub.postalCode,
    phone: pub.phone,
    photos: pub.photos,
    openingHours: (pub.openingHours as OpeningHours | null) ?? null,
    slotMinutes: pub.slotMinutes,
  };
}

/**
 * `GET /pubs/:id/events` — upcoming events for a pub: `status = scheduled` AND
 * `startTime >= now`, ordered by `startTime` ascending. 404 if the pub is unknown.
 */
export async function getPubEvents(id: string): Promise<EventDTO[]> {
  const pub = await prisma.pub.findUnique({ where: { id }, select: { id: true } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }
  const events = await prisma.event.findMany({
    where: { pubId: id, status: 'scheduled', startTime: { gte: new Date() } },
    orderBy: { startTime: 'asc' },
  });
  return events.map((event) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    capacity: event.capacity,
    coverChargeCents: event.coverChargeCents,
  }));
}
