import type { RestaurantTable } from '@prisma/client';
import type { CreateTableRequest, TableDTO, UpdateTableRequest } from '@pubster/shared';
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Tables business logic (docs/BACKEND.md §API surface). Staff/manager only —
 * routes enforce `requireRole('staff','manager')` + pub-scope. Tables are the
 * physical inventory; reservations consume a size CLASS from the pool, not a
 * specific row, so a hard delete simply reduces inventory (no FK from
 * Reservation → RestaurantTable).
 */

/** Convert a Prisma `RestaurantTable` to the public {@link TableDTO}. */
function toTableDTO(table: RestaurantTable): TableDTO {
  return {
    id: table.id,
    seats: table.seats,
    label: table.label,
    isActive: table.isActive,
  };
}

/** `GET /pubs/:id/tables` — list a pub's tables (404 if the pub is unknown). */
export async function listTables(pubId: string): Promise<TableDTO[]> {
  const pub = await prisma.pub.findUnique({ where: { id: pubId }, select: { id: true } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }
  const tables = await prisma.restaurantTable.findMany({
    where: { pubId },
    orderBy: [{ seats: 'asc' }, { createdAt: 'asc' }],
  });
  return tables.map(toTableDTO);
}

/**
 * `POST /pubs/:id/tables` — create `quantity` (default 1) identical tables of
 * `seats` seats. 404 if the pub is unknown. Returns the created tables.
 */
export async function createTables(pubId: string, body: CreateTableRequest): Promise<TableDTO[]> {
  const pub = await prisma.pub.findUnique({ where: { id: pubId }, select: { id: true } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }

  const quantity = body.quantity ?? 1;
  const data = Array.from({ length: quantity }, () => ({
    pubId,
    seats: body.seats,
    label: body.label ?? null,
  }));

  // createManyAndReturn keeps the response consistent with the created rows.
  const created = await prisma.restaurantTable.createManyAndReturn({ data });
  return created.map(toTableDTO);
}

/**
 * `PATCH /tables/:id` — partial update. The pub scope is resolved from the
 * table's own `pubId`, which the route checks before applying the change.
 * Returns the table's `pubId` alongside the DTO so the route can pub-scope.
 */
export async function getTablePubId(tableId: string): Promise<string> {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    select: { pubId: true },
  });
  if (!table) {
    throw new NotFoundError('Table not found');
  }
  return table.pubId;
}

/** `PATCH /tables/:id` — apply the update (pub scope already asserted). */
export async function updateTable(tableId: string, body: UpdateTableRequest): Promise<TableDTO> {
  const table = await prisma.restaurantTable.update({
    where: { id: tableId },
    data: {
      ...(body.seats !== undefined ? { seats: body.seats } : {}),
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  return toTableDTO(table);
}

/** `DELETE /tables/:id` — hard delete (pub scope already asserted). */
export async function deleteTable(tableId: string): Promise<void> {
  await prisma.restaurantTable.delete({ where: { id: tableId } });
}
