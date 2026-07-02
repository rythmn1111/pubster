import { z } from 'zod';
import type { CreateTableRequest, TableDTO, UpdateTableRequest } from '@pubster/shared';

/**
 * zod request/response schemas for the tables module (docs/BACKEND.md §API
 * surface — staff/manager only). Request schemas validate input (→ 400);
 * response schemas double as OpenAPI docs and are kept structurally in sync with
 * the shared DTOs via the `satisfies`-style contract assertions below (mirrors
 * the auth/pubs modules).
 */

// --- Request params / bodies -----------------------------------------------

/** `:id` path param (pub id) for `GET|POST /pubs/:id/tables`. */
export const pubIdParamsSchema = z.object({
  id: z.uuid(),
});

/** `:id` path param (table id) for `PATCH|DELETE /tables/:id`. */
export const tableIdParamsSchema = z.object({
  id: z.uuid(),
});

/** `POST /pubs/:id/tables` body — create `quantity` tables of `seats`. */
export const createTableBodySchema = z.object({
  seats: z.coerce.number().int().min(1).max(50),
  label: z.string().trim().min(1).max(120).optional(),
  quantity: z.coerce.number().int().min(1).max(100).optional(),
});

/** `PATCH /tables/:id` body — partial update (at least one field required). */
export const updateTableBodySchema = z
  .object({
    seats: z.coerce.number().int().min(1).max(50).optional(),
    label: z.string().trim().min(1).max(120).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });

// --- Responses --------------------------------------------------------------

export const tableDtoSchema = z.object({
  id: z.string(),
  seats: z.number().int(),
  label: z.string().nullable(),
  isActive: z.boolean(),
});

export const tableListSchema = z.array(tableDtoSchema);

// --- Contract checks: schemas must match the shared DTOs --------------------

type _AssertTable = z.infer<typeof tableDtoSchema> extends TableDTO ? true : never;
type _AssertCreate =
  z.infer<typeof createTableBodySchema> extends CreateTableRequest ? true : never;
type _AssertUpdate =
  z.infer<typeof updateTableBodySchema> extends UpdateTableRequest ? true : never;

const _contracts: [_AssertTable, _AssertCreate, _AssertUpdate] = [true, true, true];
void _contracts;
