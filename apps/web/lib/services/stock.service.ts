import { prisma } from '../prisma';
import {
  NotFoundError,
  ForbiddenError,
  BranchAccessDeniedError,
  ConflictError,
  InsufficientStockError,
} from '../errors';
import type { CreateProductInput, UpdateProductInput, StockMutationInput } from '../validations/stock.schema';
import { Prisma } from '@prisma/client';

export interface UserContext {
  userId: string;
  email: string;
  role: string;
  activeBranchId: string | null;
  employeeId: string | null;
}

/**
 * CRUD Master Produk (Item Independen)
 */
export async function listProducts(params: {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = {};

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.category && params.category.trim()) {
    where.category = { equals: params.category.trim(), mode: 'insensitive' };
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ name: 'asc' }],
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function createProduct(input: CreateProductInput, actorId: string, ip: string | null) {
  // Cek keunikan (name, isActive)
  const existing = await prisma.product.findFirst({
    where: {
      name: { equals: input.name.trim(), mode: 'insensitive' },
      isActive: input.isActive ?? true,
    },
  });

  if (existing) {
    throw new ConflictError('Nama produk sudah digunakan untuk status item yang sama', 'DUPLICATE_PRODUCT_NAME');
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name.trim(),
        sku: input.sku ? input.sku.trim() : null,
        unit: input.unit.trim(),
        category: input.category.trim(),
        costPrice: input.costPrice !== null && input.costPrice !== undefined ? new Prisma.Decimal(input.costPrice) : null,
        isActive: input.isActive ?? true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'CREATE',
        entity: 'Product',
        entityId: product.id,
        after: product as unknown as Prisma.InputJsonValue,
        ip,
      },
    });

    return product;
  });
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      branchStocks: {
        include: { branch: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  if (!product) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId: string, ip: string | null) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  const newName = input.name !== undefined ? input.name.trim() : existing.name;
  const newActive = input.isActive !== undefined ? input.isActive : existing.isActive;

  if (input.name !== undefined || input.isActive !== undefined) {
    const duplicate = await prisma.product.findFirst({
      where: {
        id: { not: id },
        name: { equals: newName, mode: 'insensitive' },
        isActive: newActive,
      },
    });
    if (duplicate) {
      throw new ConflictError('Nama produk sudah digunakan untuk status item yang sama', 'DUPLICATE_PRODUCT_NAME');
    }
  }

  return prisma.$transaction(async (tx) => {
    const dataToUpdate: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) dataToUpdate.name = input.name.trim();
    if (input.sku !== undefined) dataToUpdate.sku = input.sku ? input.sku.trim() : null;
    if (input.unit !== undefined) dataToUpdate.unit = input.unit.trim();
    if (input.category !== undefined) dataToUpdate.category = input.category.trim();
    if (input.costPrice !== undefined) {
      dataToUpdate.costPrice = input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null;
    }
    if (input.isActive !== undefined) dataToUpdate.isActive = input.isActive;

    const updated = await tx.product.update({
      where: { id },
      data: dataToUpdate,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'Product',
        entityId: id,
        before: existing as unknown as Prisma.InputJsonValue,
        after: updated as unknown as Prisma.InputJsonValue,
        ip,
      },
    });

    return updated;
  });
}

export async function deleteProduct(id: string, actorId: string, ip: string | null) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Produk tidak ditemukan');
  }

  return prisma.$transaction(async (tx) => {
    const deactivated = await tx.product.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'DELETE',
        entity: 'Product',
        entityId: id,
        before: existing as unknown as Prisma.InputJsonValue,
        after: deactivated as unknown as Prisma.InputJsonValue,
        ip,
        note: 'Soft delete (isActive = false)',
      },
    });

    return deactivated;
  });
}

/**
 * Resolusi hak cabang dan verifikasi Anti-IDOR
 */
export function resolveEffectiveBranchId(targetBranchId: string | undefined, user: UserContext): string {
  if (user.role === 'OWNER') {
    if (targetBranchId) return targetBranchId;
    if (user.activeBranchId) return user.activeBranchId;
    return ''; // OWNER tanpa filter cabang spesifik
  }

  // Non-OWNER wajib terikat pada cabang aktifnya
  if (!user.activeBranchId) {
    throw new BranchAccessDeniedError('Pengguna tidak memiliki cabang aktif');
  }

  if (targetBranchId && targetBranchId !== user.activeBranchId) {
    throw new BranchAccessDeniedError('Tidak punya akses ke cabang ini');
  }

  return user.activeBranchId;
}

/**
 * Query Stok per Cabang
 */
export async function getStockList(
  params: {
    branchId?: string;
    search?: string;
    category?: string;
    lowStock?: boolean;
    expiredStatus?: 'all' | 'expSoon' | 'expired';
    page?: number;
    limit?: number;
  },
  user: UserContext
) {
  let effectiveBranchId = resolveEffectiveBranchId(params.branchId, user);

  // Jika OWNER belum memilih cabang, ambil cabang pertama sebagai default
  if (!effectiveBranchId) {
    const firstBranch = await prisma.branch.findFirst({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { id: true },
    });
    if (firstBranch) {
      effectiveBranchId = firstBranch.id;
    }
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  // Filter produk
  const productWhere: Prisma.ProductWhereInput = { isActive: true };

  if (params.category && params.category.trim()) {
    productWhere.category = { equals: params.category.trim(), mode: 'insensitive' };
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    productWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Ambil produk dan stock record untuk branch yang dipilih
  const allMatchingProducts = await prisma.product.findMany({
    where: productWhere,
    include: {
      branchStocks: {
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  // Petakan dan filter di level aplikasi untuk indikator status stok & expired
  const mappedItems = allMatchingProducts.map((p) => {
    const stock = p.branchStocks[0] || null;
    const quantity = stock ? stock.quantity : 0;
    const minStock = stock ? stock.minStock : 0;
    const expiredDate = stock && stock.expiredDate ? new Date(stock.expiredDate) : null;

    let expiredWarning: 'EXPIRED' | 'EXPIRING_SOON' | 'NORMAL' = 'NORMAL';
    if (expiredDate) {
      if (expiredDate <= today) {
        expiredWarning = 'EXPIRED';
      } else if (expiredDate < thirtyDaysLater) {
        expiredWarning = 'EXPIRING_SOON';
      }
    }

    const isLowStock = quantity <= minStock;

    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unit,
      category: p.category,
      costPrice: p.costPrice,
      branchId: effectiveBranchId,
      stockId: stock ? stock.id : null,
      quantity,
      minStock,
      expiredDate: stock && stock.expiredDate ? stock.expiredDate.toISOString().split('T')[0] : null,
      expiredWarning,
      isLowStock,
      updatedAt: stock ? stock.updatedAt : p.updatedAt,
    };
  });

  // Terapkan filter lowStock dan expiredStatus
  const filtered = mappedItems.filter((item) => {
    if (params.lowStock && !item.isLowStock) {
      return false;
    }
    if (params.expiredStatus === 'expired' && item.expiredWarning !== 'EXPIRED') {
      return false;
    }
    if (params.expiredStatus === 'expSoon' && item.expiredWarning !== 'EXPIRING_SOON') {
      return false;
    }
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    stocks: paginated,
    branchId: effectiveBranchId,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Transaksi Atomik Mutasi Stok (IN / OUT / ADJUSTMENT)
 */
export async function recordStockMutation(input: StockMutationInput, actor: UserContext, ip: string | null) {
  // 1. RBAC Guard: Hanya OWNER & MANAGER yang diizinkan mutasi
  if (actor.role !== 'OWNER' && actor.role !== 'MANAGER') {
    throw new ForbiddenError('Hanya OWNER dan MANAGER yang memiliki wewenang untuk mencatat mutasi stok');
  }

  // 2. Anti-IDOR Guard: Non-OWNER hanya boleh mutasi di cabang aktif mereka
  if (actor.role !== 'OWNER') {
    if (!actor.activeBranchId || actor.activeBranchId !== input.branchId) {
      throw new BranchAccessDeniedError('Tidak punya akses mutasi ke cabang ini');
    }
  }

  return prisma.$transaction(async (tx) => {
    // Verifikasi produk aktif
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, isActive: true },
    });
    if (!product || !product.isActive) {
      throw new NotFoundError('Produk tidak ditemukan atau tidak aktif');
    }

    // Verifikasi cabang aktif
    const branch = await tx.branch.findUnique({
      where: { id: input.branchId },
      select: { id: true, code: true, name: true, active: true },
    });
    if (!branch || !branch.active) {
      throw new NotFoundError('Cabang tidak ditemukan atau tidak aktif');
    }

    // Ambil atau buat record ProductBranchStock
    let stock = await tx.productBranchStock.findUnique({
      where: {
        productId_branchId: {
          productId: input.productId,
          branchId: input.branchId,
        },
      },
    });

    if (!stock) {
      stock = await tx.productBranchStock.create({
        data: {
          productId: input.productId,
          branchId: input.branchId,
          quantity: 0,
          minStock: input.minStock !== undefined ? input.minStock : 0,
          expiredDate: input.expiredDate ? new Date(input.expiredDate) : null,
        },
      });
    }

    const qtyBefore = stock.quantity;
    let qtyAfter = qtyBefore;
    let delta = 0;

    if (input.type === 'IN') {
      qtyAfter = qtyBefore + input.qty;
      delta = input.qty;
    } else if (input.type === 'OUT') {
      if (qtyBefore < input.qty) {
        // OUT melebihi stok -> 409 DENGAN body berisi { available: N }
        throw new InsufficientStockError('Stok tidak mencukupi untuk pengeluaran barang', qtyBefore);
      }
      qtyAfter = qtyBefore - input.qty;
      delta = -input.qty;
    } else if (input.type === 'ADJUSTMENT') {
      // ADJUSTMENT: qtyAfter = qty input, delta tercatat di log
      qtyAfter = input.qty;
      delta = qtyAfter - qtyBefore;
    }

    // Update stok cabang
    const stockUpdateData: Prisma.ProductBranchStockUpdateInput = {
      quantity: qtyAfter,
    };
    if (input.expiredDate !== undefined) {
      stockUpdateData.expiredDate = input.expiredDate ? new Date(input.expiredDate) : null;
    }
    if (input.minStock !== undefined) {
      stockUpdateData.minStock = input.minStock;
    }

    const updatedStock = await tx.productBranchStock.update({
      where: { id: stock.id },
      data: stockUpdateData,
    });

    // Catat riwayat StockMovement
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        type: input.type,
        qty: input.qty,
        qtyBefore,
        qtyAfter,
        note: input.note ? input.note.trim() : null,
        userId: actor.userId,
      },
    });

    // Catat AuditLog
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'STOCK_MUTATION',
        entity: 'StockMovement',
        entityId: movement.id,
        before: { quantity: qtyBefore },
        after: {
          quantity: qtyAfter,
          type: input.type,
          delta,
          movementId: movement.id,
        },
        ip,
        note: input.note ? input.note.trim() : `Mutasi stok ${input.type}: ${delta >= 0 ? '+' : ''}${delta}`,
      },
    });

    return {
      movement,
      stock: updatedStock,
    };
  });
}

/**
 * Riwayat Mutasi Stok
 */
export async function getStockMovements(
  params: {
    productId?: string;
    branchId?: string;
    type?: 'IN' | 'OUT' | 'ADJUSTMENT';
    page?: number;
    limit?: number;
  },
  user: UserContext
) {
  const effectiveBranchId = resolveEffectiveBranchId(params.branchId, user);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.StockMovementWhereInput = {};

  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.productId) {
    where.productId = params.productId;
  }
  if (params.type) {
    where.type = params.type;
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        product: { select: { id: true, name: true, unit: true, category: true, sku: true } },
        branch: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, email: true, username: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
