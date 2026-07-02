import { Prisma } from '@prisma/client';
import type { PubSummaryDTO } from '@pubster/shared';
import { prisma } from '../db/prisma.js';

/**
 * Nearest-pubs geo query (docs/DATABASE.md §"Nearest-pubs query").
 *
 * Prisma can't express PostGIS geography operators, so this uses a raw query
 * against `Pub` and its `location geography(Point,4326)` column (kept in sync
 * with lat/lng; a GiST index makes `ST_DWithin` fast). The query point is built
 * with `ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography` (note the lng,lat
 * order) so `ST_DWithin` / `ST_Distance` operate in metres. Results are ordered
 * by ascending distance and capped at `limit`; the raw `location` blob is never
 * selected. `distanceMeters` is rounded to whole metres for the wire response.
 */
export interface NearestPubsParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}

export async function findNearestPubs(params: NearestPubsParams): Promise<PubSummaryDTO[]> {
  const { lat, lng, radiusMeters, limit } = params;
  const rows = await prisma.$queryRaw<PubSummaryDTO[]>(Prisma.sql`
    SELECT id,
           name,
           description,
           latitude,
           longitude,
           "addressLine",
           city,
           region,
           "postalCode",
           photos,
           ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS "distanceMeters"
    FROM "Pub"
    WHERE location IS NOT NULL
      AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
    ORDER BY "distanceMeters" ASC
    LIMIT ${limit};
  `);
  return rows.map((row) => ({ ...row, distanceMeters: Math.round(row.distanceMeters) }));
}
