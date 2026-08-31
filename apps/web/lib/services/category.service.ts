import { prisma } from '../prisma';
import { ConflictError, NotFoundError } from '../errors';

/**
 * Category adalah master data GLOBAL (tidak ada branchId di schema).
 * Tidak ada kolom deletedAt: "soft delete" = PATCH active:false
 * (keputusan C Tugas 4, API-CONTRACT 7 tidak punya DELETE /categories).
 */

/** Map unique constraint violation Prisma (P2002) ke 409 DUPLICATE. */
function mapCategoryError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error && 'meta' in error) {
    const err = error as { code: string; meta?: { target?: string[] } };
    if (err.code === 'P2002' && err.meta?.target?.includes('name')) {
      return new ConflictError('Nama kategori sudah digunakan', 'DUPLICATE');
    }
  }
  return error;
}

export async function listCategories(page: number, limit: number, active?: boolean) {
  const where = active !== undefined ? { active } : {};
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    throw new NotFoundError('Kategori tidak ditemukan');
  }

  return category;
}

export async function createCategory(input: { name: string }) {
  try {
    return await prisma.category.create({ data: input });
  } catch (error: unknown) {
    throw mapCategoryError(error);
  }
}

export async function updateCategory(id: string, input: { name?: string; active?: boolean }) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Kategori tidak ditemukan');
  }

  try {
    return await prisma.category.update({ where: { id }, data: input });
  } catch (error: unknown) {
    throw mapCategoryError(error);
  }
}
