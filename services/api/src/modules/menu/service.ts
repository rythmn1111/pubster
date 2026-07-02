import type { MenuCategoryDTO } from '@pubster/shared';
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../lib/errors.js';

/**
 * Menu business logic (docs/BACKEND.md §API surface). PUBLIC read.
 */

/**
 * `GET /pubs/:id/menu` — categories (ordered by `sortOrder`), each with its
 * items (ordered by `sortOrder`, `isAvailable` included). 404 if pub not found.
 */
export async function getPubMenu(pubId: string): Promise<MenuCategoryDTO[]> {
  const pub = await prisma.pub.findUnique({ where: { id: pubId }, select: { id: true } });
  if (!pub) {
    throw new NotFoundError('Pub not found');
  }
  const categories = await prisma.menuCategory.findMany({
    where: { pubId },
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    items: category.items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
    })),
  }));
}
