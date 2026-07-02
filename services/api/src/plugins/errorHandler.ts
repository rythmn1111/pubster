import fp from 'fastify-plugin';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@pubster/shared';
import { AppError } from '../lib/errors.js';
import { isProduction } from '../config/env.js';

/**
 * Central error handler — maps every thrown error to the canonical
 * `{ error: { code, message, details? } }` envelope (docs/BACKEND.md §Conventions).
 */
export default fp(
  async (app) => {
    // Unknown routes -> canonical error envelope (Fastify's default 404 uses a
    // different shape, so we override it for a consistent API contract).
    app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      const body: ApiErrorBody = {
        error: {
          code: 'NOT_FOUND',
          message: `Route ${request.method}:${request.url} not found`,
        },
      };
      reply.code(404).send(body);
    });

    app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      // 1. Typed application errors.
      if (error instanceof AppError) {
        reply.code(error.statusCode).send(error.toBody());
        return;
      }

      // 2. Zod errors thrown directly in service code.
      if (error instanceof ZodError) {
        const body: ApiErrorBody = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.issues,
          },
        };
        reply.code(400).send(body);
        return;
      }

      // 3. Fastify schema validation (populated by fastify-type-provider-zod).
      if (error.validation) {
        const body: ApiErrorBody = {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: error.validation,
          },
        };
        reply.code(400).send(body);
        return;
      }

      // 4. A couple of common Prisma known-request errors.
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
          return;
        }
        if (error.code === 'P2002') {
          reply
            .code(409)
            .send({ error: { code: 'CONFLICT', message: 'Unique constraint violation' } });
          return;
        }
      }

      // 5. Any error carrying a client-side HTTP status (e.g. Fastify 404/415).
      const statusCode = error.statusCode ?? 500;
      if (statusCode < 500) {
        const body: ApiErrorBody = {
          error: { code: error.code ?? 'ERROR', message: error.message },
        };
        reply.code(statusCode).send(body);
        return;
      }

      // 6. Unexpected — log and hide details in production.
      request.log.error(error);
      const body: ApiErrorBody = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: isProduction ? 'Internal server error' : error.message,
        },
      };
      reply.code(500).send(body);
    });
  },
  { name: 'error-handler' },
);
