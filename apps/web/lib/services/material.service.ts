import { prisma } from '../prisma';
import { ConflictError, NotFoundError } from '../errors';

/**
 * Material (Bahan) — master data GLOBAL (tidak ada branchId; stok per cabang
 * hidup di StockLevel/InventoryMovement).
 * Material tidak dijual, jadi TIDAK pernah direferensikan TransactionItem;
 * pengecekan "sudah dipakai" hanya lewat InventoryMovement.materialId.
 * sku @unique -> P2002 dipetakan ke 409 DUPLICATE.
 * Soft delete via deletedAt (keputusan B1); list/get mengecualikan
 * deletedAt != null; PATCH item deleted -> 404.
 */

const NOT_DELETED = { deletedAt: null };

/** Map unique constraint violation Prisma (P2002) ke 409 DUPLICATE. */
function mapMaterialError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error && 'meta' in error) {
    const err = error as { code: string; meta?: { target?: string[] } };
    if (err.code === 'P2002' && err.meta?.target?.includes('sku')) {
      return new ConflictError('SKU bahan sudah digunakan', 'DUPLICATE');
    }
  }
  return error;
}

export async function listMaterials(page: number, limit: number, active?: boolean) {
  const where = active !== undefined ? { active, ...NOT_DELETED } : { ...NOT_DELETED };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: { sku: 'asc' },
      skip,
      take: limit,
    }),
    prisma.material.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getMaterialById(id: string) {
  const material = await prisma.material.findFirst({ where: { id, ...NOT_DELETED } });
  if (!material) {
    throw new NotFoundError('Bahan tidak ditemukan');
  }
  return material;
}

export async function createMaterial(input: {
  name: string;
  sku: string;
  unit: string;
  minStock?: number;
  isStockTracked?: boolean;
  active?: boolean;
}) {
  try {
    return await prisma.material.create({ data: input });
  } catch (error: unknown) {
    throw mapMaterialError(error);
  }
}

export async function updateMaterial(
  id: string,
  input: {
    name?: string;
    sku?: string;
    unit?: string;
    minStock?: number;
    isStockTracked?: boolean;
    active?: boolean;
  },
) {
  const existing = await prisma.material.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Bahan tidak ditemukan');
  }

  try {
    return await prisma.material.update({ where: { id }, data: input });
  } catch (error: unknown) {
    throw mapMaterialError(error);
  }
}

/**
 * Hapus bahan (keputusan B1).
 * Dipakai = ada InventoryMovement.materialId.
 * Fallback P2003 -> soft delete (bukan 409), konsisten dengan product/service.
 */
export async function deleteMaterial(id: string) {
  const existing = await prisma.material.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Bahan tidak ditemukan');
  }

  const movementCount = await prisma.inventoryMovement.count({ where: { materialId: id } });

  if (movementCount > 0) {
    const soft = await prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
    return { mode: 'soft', material: soft };
  }

  try {
    await prisma.material.delete({ where: { id } });
    return { mode: 'hard', material: existing };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const err = error as { code: string };
      if (err.code === 'P2003') {
        const soft = await prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
        return { mode: 'soft', material: soft };
      }
    }
    throw error;
  }
}
