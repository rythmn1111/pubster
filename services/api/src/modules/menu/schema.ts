import { z } from 'zod';
import type { MenuCategoryDTO, MenuItemDTO } from '@pubster/shared';

/**
 * zod schemas for the menu module (docs/BACKEND.md §API surface). The response
 * schema doubles as OpenAPI docs and is kept in sync with the shared DTOs via
 * the `satisfies`-style contract assertions below (mirrors the auth module).
 */

/** `:id` path param for `GET /pubs/:id/menu`. */
export const pubIdParamsSchema = z.object({
  id: z.uuid(),
});

export const menuItemDtoSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  sortOrder: z.number().int(),
});

export const menuCategoryDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  items: z.array(menuItemDtoSchema),
});

export const menuCategoryListSchema = z.array(menuCategoryDtoSchema);

// --- Contract checks: schemas must match the shared DTOs --------------------

type _AssertMenuItem = z.infer<typeof menuItemDtoSchema> extends MenuItemDTO ? true : never;
type _AssertMenuCategory =
  z.infer<typeof menuCategoryDtoSchema> extends MenuCategoryDTO ? true : never;

const _contracts: [_AssertMenuItem, _AssertMenuCategory] = [true, true];
void _contracts;
