import { getSkuPrefixByCategory } from '@oase/shared';
import { prisma } from '../prisma';
import {
  NotFoundError,
  ForbiddenError,
  BranchAccessDeniedError,
  ConflictError,
  InsufficientStockError,
} from '../errors';
import type { UpdateProductInput, StockMutationInput } from '../validations/stock.schema';
import { Prisma } from '@prisma/client';

export interface UserContext {
  userId: string;
  email: string;
  role: string;
  activeBranchId: string | null;
  employeeId: string | null;
}

/**
 * Mendapatkan SKU berikutnya berdasarkan max(sequence material existing dengan prefix sama) + 1.
 */
export async function getNextProductSku(category: string): Promise<string> {
  const prefix = getSkuPrefixByCategory(category);
  const items = await prisma.material.findMany({
    where: {
      sku: {
        startsWith: `${prefix}-`,
        mode: 'insensitive',
      },
    },
    select: { sku: true },
  });

  let maxSeq = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)`, 'i');
  for (const item of items) {
    if (!item.sku) continue;
    const match = item.sku.match(regex);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Guard Satu Pintu: Penambahan item dilarang lewat modul Stok.
 * Item HANYA boleh dibuat melalui Master Data Bahan Klinis (/api/v1/materials).
 */
export async function createProduct(..._args: unknown[]) {
  void _args;
  throw new ForbiddenError(
    'Pembuatan item barang hanya dapat dilakukan melalui Master Data Bahan Klinis (/api/v1/materials)'
  );
}

/**
 * Adaptor Master Item membaca dari Material (Single Source of Truth)
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

  const where: Prisma.MaterialWhereInput = { deletedAt: null };

  if (params.isActive !== undefined) {
    where.active = params.isActive;
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

  const [materials, total] = await Promise.all([
    prisma.material.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ name: 'asc' }],
    }),
    prisma.material.count({ where }),
  ]);

  const products = materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    category: m.category,
    costPrice: m.costPrice,
    isActive: m.active,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

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

export async function getProductById(id: string) {
  const material = await prisma.material.findFirst({
    where: { id, deletedAt: null },
    include: {
      branchStocks: {
        include: { branch: { select: { id: true, code: true, name: true } } },
      },
      stockBatches: {
        where: { quantity: { gt: 0 } },
        orderBy: { expiredDate: 'asc' },
      },
    },
  });

  if (!material) {
    throw new NotFoundError('Item bahan klinis tidak ditemukan');
  }

  return {
    id: material.id,
    name: material.name,
    sku: material.sku,
    unit: material.unit,
    category: material.category,
    costPrice: material.costPrice,
    isActive: material.active,
    branchStocks: material.branchStocks,
    stockBatches: material.stockBatches,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId: string, ip: string | null) {
  const existing = await prisma.material.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new NotFoundError('Item bahan klinis tidak ditemukan');
  }

  const newName = input.name !== undefined ? input.name.trim() : existing.name;
  const newActive = input.isActive !== undefined ? input.isActive : existing.active;

  if (input.name !== undefined || input.isActive !== undefined) {
    const duplicate = await prisma.material.findFirst({
      where: {
        id: { not: id },
        deletedAt: null,
        name: { equals: newName, mode: 'insensitive' },
        active: newActive,
      },
    });
    if (duplicate) {
      throw new ConflictError('Nama bahan klinis sudah digunakan untuk status item yang sama', 'DUPLICATE_PRODUCT_NAME');
    }
  }

  if (input.sku !== undefined && input.sku !== null && input.sku.trim()) {
    const newSku = input.sku.trim();
    if (newSku !== existing.sku) {
      const duplicateSku = await prisma.material.findFirst({
        where: {
          id: { not: id },
          sku: { equals: newSku, mode: 'insensitive' },
        },
      });
      if (duplicateSku) {
        throw new ConflictError('Kode SKU bahan klinis sudah digunakan', 'DUPLICATE_PRODUCT_SKU');
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const dataToUpdate: Prisma.MaterialUpdateInput = {};
    if (input.name !== undefined) dataToUpdate.name = input.name.trim();
    if (input.sku !== undefined) dataToUpdate.sku = input.sku ? input.sku.trim() : existing.sku;
    if (input.unit !== undefined) dataToUpdate.unit = input.unit.trim();
    if (input.category !== undefined) dataToUpdate.category = input.category.trim();
    if (input.costPrice !== undefined) {
      dataToUpdate.costPrice = input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null;
    }
    if (input.isActive !== undefined) dataToUpdate.active = input.isActive;

    const updated = await tx.material.update({
      where: { id },
      data: dataToUpdate,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entity: 'Material',
        entityId: id,
        before: existing as unknown as Prisma.InputJsonValue,
        after: updated as unknown as Prisma.InputJsonValue,
        ip,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      unit: updated.unit,
      category: updated.category,
      costPrice: updated.costPrice,
      isActive: updated.active,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  });
}

export async function deleteProduct(id: string, actorId: string, ip: string | null) {
  const existing = await prisma.material.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new NotFoundError('Item bahan klinis tidak ditemukan');
  }

  return prisma.$transaction(async (tx) => {
    const deactivated = await tx.material.update({
      where: { id },
      data: { active: false },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'DELETE',
        entity: 'Material',
        entityId: id,
        before: existing as unknown as Prisma.InputJsonValue,
        after: deactivated as unknown as Prisma.InputJsonValue,
        ip,
        note: 'Soft delete (active = false)',
      },
    });

    return {
      id: deactivated.id,
      isActive: deactivated.active,
    };
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
 * Query Stok per Cabang (Single Source of Truth: Material + MaterialBranchStock + MaterialStockBatch)
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

  const materialWhere: Prisma.MaterialWhereInput = {
    deletedAt: null,
    active: true,
  };

  if (params.category && params.category.trim()) {
    materialWhere.category = { equals: params.category.trim(), mode: 'insensitive' };
  }

  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    materialWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { sku: { contains: q, mode: 'insensitive' } },
    ];
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Ambil data bahan klinis beserta stok cabang dan batch kedaluwarsa aktif
  const allMaterials = await prisma.material.findMany({
    where: materialWhere,
    include: {
      branchStocks: {
        where: effectiveBranchId ? { branchId: effectiveBranchId } : undefined,
      },
      stockBatches: {
        where: {
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
          quantity: { gt: 0 },
        },
        orderBy: { expiredDate: 'asc' },
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  const mappedItems = allMaterials.map((m) => {
    const stock = m.branchStocks[0] || null;
    const quantity = stock ? stock.quantity : 0;
    const minStock = stock ? stock.minStock : (m.minStock || 0);

    // KEPUTUSAN KEDALUWARSA (BATCH-BASED):
    // Agregasi membaca batch aktif terdekat per item (bila ada batch dengan expiredDate)
    const batchesWithExpiry = (m.stockBatches || []).filter((b) => b.expiredDate !== null);
    const earliestBatch = batchesWithExpiry.length > 0 ? batchesWithExpiry[0] : null;
    const earliestExpiredDate = earliestBatch?.expiredDate ? new Date(earliestBatch.expiredDate) : null;

    let expiredWarning: 'EXPIRED' | 'EXPIRING_SOON' | 'NORMAL' = 'NORMAL';
    if (earliestExpiredDate) {
      if (earliestExpiredDate <= today) {
        expiredWarning = 'EXPIRED';
      } else if (earliestExpiredDate < thirtyDaysLater) {
        expiredWarning = 'EXPIRING_SOON';
      }
    }

    const isLowStock = quantity <= minStock;

    return {
      productId: m.id,
      materialId: m.id,
      name: m.name,
      sku: m.sku,
      unit: m.unit,
      category: m.category,
      costPrice: m.costPrice,
      branchId: effectiveBranchId,
      stockId: stock ? stock.id : null,
      quantity,
      minStock,
      expiredDate: earliestExpiredDate ? earliestExpiredDate.toISOString().split('T')[0] : null,
      expiredWarning,
      isLowStock,
      batchCount: batchesWithExpiry.length,
      updatedAt: stock ? stock.updatedAt : m.updatedAt,
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
 * Transaksi Atomik Mutasi Stok (IN / OUT / ADJUSTMENT) dengan pencatatan batch kedaluwarsa
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

  const targetMaterialId = input.materialId || input.productId;
  if (!targetMaterialId) {
    throw new NotFoundError('ID bahan klinis tidak diberikan');
  }

  return prisma.$transaction(async (tx) => {
    // Verifikasi bahan klinis aktif & tidak terhapus
    const material = await tx.material.findFirst({
      where: { id: targetMaterialId, deletedAt: null, active: true },
      select: { id: true, name: true, active: true, costPrice: true, minStock: true },
    });
    if (!material) {
      throw new NotFoundError('Bahan klinis tidak ditemukan atau tidak aktif');
    }

    // Verifikasi cabang aktif
    const branch = await tx.branch.findUnique({
      where: { id: input.branchId },
      select: { id: true, code: true, name: true, active: true },
    });
    if (!branch || !branch.active) {
      throw new NotFoundError('Cabang tidak ditemukan atau tidak aktif');
    }

    // Ambil atau buat record MaterialBranchStock
    let stock = await tx.materialBranchStock.findUnique({
      where: {
        materialId_branchId: {
          materialId: targetMaterialId,
          branchId: input.branchId,
        },
      },
    });

    if (!stock) {
      stock = await tx.materialBranchStock.create({
        data: {
          materialId: targetMaterialId,
          branchId: input.branchId,
          quantity: 0,
          minStock: input.minStock !== undefined ? input.minStock : (material.minStock || 0),
        },
      });
    }

    const qtyBefore = stock.quantity;
    let qtyAfter = qtyBefore;
    let delta = 0;
    let batchRecordId: string | null = null;

    if (input.type === 'IN') {
      qtyAfter = qtyBefore + input.qty;
      delta = input.qty;

      // Pencatatan Batch Kedaluwarsa bila expiredDate diinput
      if (input.expiredDate) {
        const expDate = new Date(input.expiredDate);
        const batchNum = input.batchNumber ? input.batchNumber.trim() : null;

        let existingBatch = await tx.materialStockBatch.findFirst({
          where: {
            materialId: targetMaterialId,
            branchId: input.branchId,
            expiredDate: expDate,
            ...(batchNum ? { batchNumber: batchNum } : {}),
          },
        });

        if (existingBatch) {
          existingBatch = await tx.materialStockBatch.update({
            where: { id: existingBatch.id },
            data: { quantity: existingBatch.quantity + input.qty },
          });
          batchRecordId = existingBatch.id;
        } else {
          const newBatch = await tx.materialStockBatch.create({
            data: {
              materialId: targetMaterialId,
              branchId: input.branchId,
              batchNumber: batchNum,
              quantity: input.qty,
              expiredDate: expDate,
              costPrice: material.costPrice,
            },
          });
          batchRecordId = newBatch.id;
        }
      }
    } else if (input.type === 'OUT') {
      if (qtyBefore < input.qty) {
        // OUT melebihi stok -> 409 DENGAN body berisi { available: N }
        throw new InsufficientStockError('Stok tidak mencukupi untuk pengeluaran barang', qtyBefore);
      }
      qtyAfter = qtyBefore - input.qty;
      delta = -input.qty;

      // Pengurangan batch berbasis FEFO (First Expired First Out)
      let remainingToDeduct = input.qty;
      const activeBatches = await tx.materialStockBatch.findMany({
        where: {
          materialId: targetMaterialId,
          branchId: input.branchId,
          quantity: { gt: 0 },
        },
        orderBy: [
          { expiredDate: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      for (const b of activeBatches) {
        if (remainingToDeduct <= 0) break;
        const deductAmount = Math.min(b.quantity, remainingToDeduct);
        await tx.materialStockBatch.update({
          where: { id: b.id },
          data: { quantity: b.quantity - deductAmount },
        });
        remainingToDeduct -= deductAmount;
      }
    } else if (input.type === 'ADJUSTMENT') {
      // ADJUSTMENT: qtyAfter = qty input, delta tercatat di log
      qtyAfter = input.qty;
      delta = qtyAfter - qtyBefore;

      // Bila ada informasi batch saat opname fisik
      if (input.expiredDate) {
        const expDate = new Date(input.expiredDate);
        const batchNum = input.batchNumber ? input.batchNumber.trim() : null;
        const adjBatch = await tx.materialStockBatch.create({
          data: {
            materialId: targetMaterialId,
            branchId: input.branchId,
            batchNumber: batchNum,
            quantity: input.qty,
            expiredDate: expDate,
            costPrice: material.costPrice,
          },
        });
        batchRecordId = adjBatch.id;
      }
    }

    // Update stok cabang
    const stockUpdateData: Prisma.MaterialBranchStockUpdateInput = {
      quantity: qtyAfter,
    };
    if (input.minStock !== undefined) {
      stockUpdateData.minStock = input.minStock;
    }

    const updatedStock = await tx.materialBranchStock.update({
      where: { id: stock.id },
      data: stockUpdateData,
    });

    // Catat riwayat StockMovement
    const movement = await tx.stockMovement.create({
      data: {
        materialId: targetMaterialId,
        branchId: input.branchId,
        batchId: batchRecordId,
        type: input.type,
        qty: input.qty,
        qtyBefore,
        qtyAfter,
        costPrice: material.costPrice,
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
    materialId?: string;
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
  const targetId = params.materialId || params.productId;
  if (targetId) {
    where.materialId = targetId;
  }
  if (params.type) {
    where.type = params.type;
  }

  const [rawMovements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        material: { select: { id: true, name: true, unit: true, category: true, sku: true } },
        branch: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, email: true, username: true } },
        batch: { select: { id: true, batchNumber: true, expiredDate: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  // Petakan material sebagai product untuk kompatibilitas frontend & test
  const movements = rawMovements.map((m) => ({
    id: m.id,
    productId: m.materialId,
    materialId: m.materialId,
    branchId: m.branchId,
    type: m.type,
    qty: m.qty,
    qtyBefore: m.qtyBefore,
    qtyAfter: m.qtyAfter,
    costPrice: m.costPrice,
    note: m.note,
    userId: m.userId,
    createdAt: m.createdAt,
    product: m.material,
    material: m.material,
    branch: m.branch,
    user: m.user,
    batch: m.batch,
  }));

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
