import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { menuCategoryListSchema, pubIdParamsSchema } from './schema.js';
import * as service from './service.js';

/**
 * Menu routes — `/api/v1/pubs/:id/menu` (docs/BACKEND.md §API surface). PUBLIC
 * (no auth). Registered in `app.ts` under the `/api/v1` prefix.
 */
const menuRoutes: FastifyPluginAsync = async (app) => {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/pubs/:id/menu',
    {
      schema: {
        tags: ['menu'],
        summary: 'Menu categories with items for a pub',
        params: pubIdParamsSchema,
        response: { 200: menuCategoryListSchema },
      },
    },
    async (request) => service.getPubMenu(request.params.id),
  );
};

export default menuRoutes;
