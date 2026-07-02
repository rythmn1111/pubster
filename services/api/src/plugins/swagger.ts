import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/**
 * OpenAPI docs. zod route schemas are converted to JSON Schema by
 * `jsonSchemaTransform` (fastify-type-provider-zod). UI served at `/docs`.
 */
export default fp(
  async (app) => {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Pubster API',
          description: 'Backend API for the Pubster platform.',
          version: '0.0.0',
        },
        servers: [{ url: '/' }],
      },
      transform: jsonSchemaTransform,
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  },
  { name: 'swagger' },
);
