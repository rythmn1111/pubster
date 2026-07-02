import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { HealthResponse } from '@pubster/shared';

import { isProduction, isTest } from './config/env.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import corsPlugin from './plugins/cors.js';
import swaggerPlugin from './plugins/swagger.js';
import authPlugin from './plugins/auth.js';

import authRoutes from './modules/auth/routes.js';
import pubsRoutes from './modules/pubs/routes.js';
import tablesRoutes from './modules/tables/routes.js';
import reservationsRoutes from './modules/reservations/routes.js';
import menuRoutes from './modules/menu/routes.js';

/**
 * Build and configure the Fastify instance (plugins + routes).
 * Kept separate from `server.ts` so tests can build the app without listening.
 */
export async function buildApp() {
  const app = Fastify({
    // Silent under test (keeps `fastify.inject()` output clean); structured
    // pino logging otherwise (captured by PM2 in production).
    logger: isTest ? false : { level: isProduction ? 'info' : 'debug' },
  }).withTypeProvider<ZodTypeProvider>();

  // Validate/serialize route schemas with zod.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Cross-cutting plugins.
  await app.register(errorHandlerPlugin);
  await app.register(corsPlugin);
  await app.register(swaggerPlugin);
  await app.register(authPlugin);

  // Health checks.
  const health = (): HealthResponse => ({ status: 'ok' });
  app.get('/health', async () => health());
  app.get('/api/v1/health', async () => health());

  // Module routes (Phase-1 modules wired; each is an empty stub for now).
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(pubsRoutes, { prefix: '/api/v1/pubs' });
  await app.register(tablesRoutes, { prefix: '/api/v1' });
  await app.register(reservationsRoutes, { prefix: '/api/v1' });
  await app.register(menuRoutes, { prefix: '/api/v1' });

  return app;
}
