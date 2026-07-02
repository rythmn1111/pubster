import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

/**
 * CORS — locked to the dashboard origin(s) from `CORS_ORIGINS`
 * (docs/BACKEND.md §Security).
 */
export default fp(
  async (app) => {
    await app.register(cors, {
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    });
  },
  { name: 'cors' },
);
