import type { ApiErrorBody, ApiErrorShape } from '@pubster/shared';

/**
 * Typed application errors.
 *
 * Thrown from services/routes and mapped to the canonical
 * `{ error: { code, message, details? } }` envelope by the central error
 * handler (see `plugins/errorHandler.ts` and docs/BACKEND.md §Conventions).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  /** Serialize to the wire error shape. */
  toBody(): ApiErrorBody {
    const error: ApiErrorShape = { code: this.code, message: this.message };
    if (this.details !== undefined) {
      error.details = this.details;
    }
    return { error };
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}
