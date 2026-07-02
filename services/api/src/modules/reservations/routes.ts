import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AccessTokenClaims } from '../../lib/jwt.js';
import { assertPubScope } from '../../plugins/auth.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  availabilityListSchema,
  availabilityQuerySchema,
  createReservationBodySchema,
  pubIdParamsSchema,
  pubReservationsQuerySchema,
  reservationDtoSchema,
  reservationIdParamsSchema,
  reservationListSchema,
  updateStatusBodySchema,
} from './schema.js';
import * as service from './service.js';

/** The authenticated caller (set by requireAuth/requireRole), or 401 if absent. */
function requireUser(request: FastifyRequest): AccessTokenClaims {
  if (!request.user) {
    throw new UnauthorizedError();
  }
  return request.user;
}

/**
 * Reservations routes — availability (public), race-safe booking + cancel
 * (consumer), and staff management (docs/BACKEND.md §API surface). Registered in
 * `app.ts` under the `/api/v1` prefix.
 */
const reservationsRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const staffOrManager = app.requireRole('staff', 'manager');

  // --- Public availability --------------------------------------------------
  r.get(
    '/pubs/:id/availability',
    {
      schema: {
        tags: ['reservations'],
        summary: 'Slot availability for a date + party size',
        params: pubIdParamsSchema,
        querystring: availabilityQuerySchema,
        response: { 200: availabilityListSchema },
      },
    },
    async (request) =>
      service.getAvailability(request.params.id, request.query.date, request.query.partyCount),
  );

  // --- Consumer booking / listing / cancel ----------------------------------
  r.post(
    '/reservations',
    {
      preHandler: app.requireAuth,
      schema: {
        tags: ['reservations'],
        summary: 'Book a table for a slot (race-safe)',
        body: createReservationBodySchema,
        response: { 201: reservationDtoSchema },
      },
    },
    async (request, reply) => {
      const user = requireUser(request);
      const created = await service.createReservation(user.sub, request.body);
      reply.code(201);
      return created;
    },
  );

  r.get(
    '/reservations/me',
    {
      preHandler: app.requireAuth,
      schema: {
        tags: ['reservations'],
        summary: 'The caller’s reservations (most recent first)',
        response: { 200: reservationListSchema },
      },
    },
    async (request) => service.getMyReservations(requireUser(request).sub),
  );

  r.post(
    '/reservations/:id/cancel',
    {
      preHandler: app.requireAuth,
      schema: {
        tags: ['reservations'],
        summary: 'Cancel your own reservation (frees the slot)',
        params: reservationIdParamsSchema,
        response: { 200: reservationDtoSchema },
      },
    },
    async (request) => service.cancelReservation(requireUser(request).sub, request.params.id),
  );

  // --- Staff / manager (pub-scoped) -----------------------------------------
  r.get(
    '/pubs/:id/reservations',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['reservations'],
        summary: 'Reservations for a pub on a date (staff/manager)',
        params: pubIdParamsSchema,
        querystring: pubReservationsQuerySchema,
        response: { 200: reservationListSchema },
      },
    },
    async (request) => {
      assertPubScope(requireUser(request), request.params.id);
      return service.listPubReservations(request.params.id, request.query.date);
    },
  );

  r.post(
    '/reservations/:id/status',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['reservations'],
        summary: 'Set a reservation status: seated/completed/no_show (staff/manager)',
        params: reservationIdParamsSchema,
        body: updateStatusBodySchema,
        response: { 200: reservationDtoSchema },
      },
    },
    async (request) => {
      const pubId = await service.getReservationPubId(request.params.id);
      assertPubScope(requireUser(request), pubId);
      return service.setReservationStatus(request.params.id, request.body);
    },
  );
};

export default reservationsRoutes;
