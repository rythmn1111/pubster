import { Prisma } from '@prisma/client';
import type { NearestPubDTO } from '@pubster/shared';
import { prisma } from '../db/prisma.js';

/**
 * Nearest-pubs geo query (skeleton — see docs/DATABASE.md §"Nearest-pubs query").
 *
 * Prisma can't express PostGIS geography operators, so this uses a raw query.
 * It depends on the `Pub` table and its `location geography(Point,4326)` column
 * (kept in sync with lat/lng) plus a GiST index — all added when the full schema
 * and its raw PostGIS migration land. Until then this compiles but will fail at
 * runtime; it documents the intended query signature.
 */
export interface NearestPubsParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}

export function findNearestPubs(params: NearestPubsParams): Promise<NearestPubDTO[]> {
  const { lat, lng, radiusMeters, limit } = params;
  return prisma.$queryRaw<NearestPubDTO[]>(Prisma.sql`
    SELECT id,
           name,
           latitude,
           longitude,
           ST_Distance(location, ST_MakePoint(${lng}, ${lat})::geography) AS "distanceMeters"
    FROM "Pub"
    WHERE ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, ${radiusMeters})
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit};
  `);
}
