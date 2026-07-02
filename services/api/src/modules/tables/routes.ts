import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AccessTokenClaims } from '../../lib/jwt.js';
import { assertPubScope } from '../../plugins/auth.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  createTableBodySchema,
  pubIdParamsSchema,
  tableDtoSchema,
  tableIdParamsSchema,
  tableListSchema,
  updateTableBodySchema,
} from './schema.js';
import * as service from './service.js';

/** The authenticated caller (set by requireRole), or 401 if somehow absent. */
function requireUser(request: FastifyRequest): AccessTokenClaims {
  if (!request.user) {
    throw new UnauthorizedError();
  }
  return request.user;
}

/**
 * Tables routes — table inventory CRUD (docs/BACKEND.md §API surface).
 * ALL staff/manager only: `requireRole('staff','manager')` plus per-request
 * pub-scoping (`assertPubScope`). Registered in `app.ts` under `/api/v1`.
 */
const tablesRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const staffOrManager = app.requireRole('staff', 'manager');

  r.get(
    '/pubs/:id/tables',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['tables'],
        summary: 'List a pub’s table inventory (staff/manager)',
        params: pubIdParamsSchema,
        response: { 200: tableListSchema },
      },
    },
    async (request) => {
      assertPubScope(requireUser(request), request.params.id);
      return service.listTables(request.params.id);
    },
  );

  r.post(
    '/pubs/:id/tables',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['tables'],
        summary: 'Create quantity× tables of a given size (staff/manager)',
        params: pubIdParamsSchema,
        body: createTableBodySchema,
        response: { 201: tableListSchema },
      },
    },
    async (request, reply) => {
      assertPubScope(requireUser(request), request.params.id);
      const created = await service.createTables(request.params.id, request.body);
      reply.code(201);
      return created;
    },
  );

  r.patch(
    '/tables/:id',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['tables'],
        summary: 'Update a single table (staff/manager, pub-scoped)',
        params: tableIdParamsSchema,
        body: updateTableBodySchema,
        response: { 200: tableDtoSchema },
      },
    },
    async (request) => {
      // Pub scope is resolved from the table's own pubId.
      const pubId = await service.getTablePubId(request.params.id);
      assertPubScope(requireUser(request), pubId);
      return service.updateTable(request.params.id, request.body);
    },
  );

  r.delete(
    '/tables/:id',
    {
      preHandler: staffOrManager,
      schema: {
        tags: ['tables'],
        summary: 'Hard-delete a table — reduces inventory (staff/manager, pub-scoped)',
        params: tableIdParamsSchema,
      },
    },
    async (request, reply) => {
      const pubId = await service.getTablePubId(request.params.id);
      assertPubScope(requireUser(request), pubId);
      await service.deleteTable(request.params.id);
      return reply.code(204).send();
    },
  );
};

export default tablesRoutes;
