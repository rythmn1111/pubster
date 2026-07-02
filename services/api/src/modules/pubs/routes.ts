import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  eventListSchema,
  nearestPubsQuerySchema,
  pubDetailDtoSchema,
  pubIdParamsSchema,
  pubSummaryListSchema,
} from './schema.js';
import * as service from './service.js';

/**
 * Pubs routes — `/api/v1/pubs/*` (docs/BACKEND.md §API surface). All PUBLIC
 * (no auth). Registered in `app.ts`; the prefix is applied there.
 */
const pubsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/nearest',
    {
      schema: {
        tags: ['pubs'],
        summary: 'Nearest pubs by distance (PostGIS)',
        querystring: nearestPubsQuerySchema,
        response: { 200: pubSummaryListSchema },
      },
    },
    async (request) => {
      const { lat, lng, radius, limit } = request.query;
      return service.getNearestPubs({ lat, lng, radiusMeters: radius, limit });
    },
  );

  r.get(
    '/:id',
    {
      schema: {
        tags: ['pubs'],
        summary: 'Pub detail',
        params: pubIdParamsSchema,
        response: { 200: pubDetailDtoSchema },
      },
    },
    async (request) => service.getPubDetail(request.params.id),
  );

  r.get(
    '/:id/events',
    {
      schema: {
        tags: ['pubs'],
        summary: 'Upcoming events for a pub',
        params: pubIdParamsSchema,
        response: { 200: eventListSchema },
      },
    },
    async (request) => service.getPubEvents(request.params.id),
  );
};

export default pubsRoutes;
