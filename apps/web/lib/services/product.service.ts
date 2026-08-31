import { prisma } from '../prisma';
import { ConflictError, NotFoundError } from '../errors';

/**
 * Product (Produk jual) — master data GLOBAL (tidak ada branchId; stok per
 * cabang hidup di StockLevel/InventoryMovement, bukan di master ini).
 * sku @unique -> P2002 dipetakan ke 409 DUPLICATE (pola dari branches).
 * Soft delete via deletedAt (keputusan B1):
 *  - belum dipakai TransactionItem/InventoryMovement -> hard delete
 *  - sudah dipakai                                   -> soft delete
 * Semua list/get mengecualikan deletedAt != null; PATCH item deleted -> 404.
 */

const NOT_DELETED = { deletedAt: null };

/** Map unique constraint violation Prisma (P2002) ke 409 DUPLICATE. */
function mapProductError(error: unknown): unknown {
  if (typeof error === 'object' && error !== null && 'code' in error && 'meta' in error) {
    const err = error as { code: string; meta?: { target?: string[] } };
    if (err.code === 'P2002' && err.meta?.target?.includes('sku')) {
      return new ConflictError('SKU produk sudah digunakan', 'DUPLICATE');
    }
  }
  return error;
}

export async function listProducts(page: number, limit: number, active?: boolean) {
  const where = active !== undefined ? { active, ...NOT_DELETED } : { ...NOT_DELETED };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({ where: { id, ...NOT_DELETED } });
  if (!product) {
    throw new NotFoundError('Produk tidak ditemukan');
  }
  return product;
}

export async function createProduct(input: {
  name: string;
  sku: string;
  sellPrice: number;
  unit: string;
  minStock?: number;
  active?: boolean;
}) {
  try {
    return await prisma.product.create({ data: input });
  } catch (error: unknown) {
    throw mapProductError(error);
  }
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    sku?: string;
    sellPrice?: number;
    unit?: string;
    minStock?: number;
    active?: boolean;
  },
) {
  const existing = await prisma.product.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  try {
    return await prisma.product.update({ where: { id }, data: input });
  } catch (error: unknown) {
    throw mapProductError(error);
  }
}

/**
 * Hapus produk (keputusan B1).
 * Dipakai = ada TransactionItem.productId ATAU InventoryMovement.productId.
 * Fallback P2003 (FK dari referensi lain) -> soft delete, bukan 409,
 * agar aksi hapus tetap idempoten dan histori aman.
 */
export async function deleteProduct(id: string) {
  const existing = await prisma.product.findFirst({ where: { id, ...NOT_DELETED } });
  if (!existing) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  const [txCount, movementCount] = await Promise.all([
    prisma.transactionItem.count({ where: { productId: id } }),
    prisma.inventoryMovement.count({ where: { productId: id } }),
  ]);

  if (txCount + movementCount > 0) {
    const soft = await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
    return { mode: 'soft', product: soft };
  }

  try {
    await prisma.product.delete({ where: { id } });
    return { mode: 'hard', product: existing };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const err = error as { code: string };
      if (err.code === 'P2003') {
        const soft = await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
        return { mode: 'soft', product: soft };
      }
    }
    throw error;
  }
}
