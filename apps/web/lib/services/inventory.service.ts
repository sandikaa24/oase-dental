import { Prisma, type UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '@/lib/errors';
import type {
  StockInInput,
  StockListQueryInput,
  MovementListQueryInput,
  CreateStockOpnameInput,
  UpdateStockOpnameInput,
  StockOpnameListQueryInput,
} from '@/lib/validations/inventory.schema';

/**
 * GET /api/v1/inventory/stock
 * Menampilkan daftar stok per cabang + master join + minStock comparison
 */
export async function listStock(
  query: StockListQueryInput,
  role: UserRole,
  activeBranchId: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = query.branchId ?? activeBranchId ?? null;
  } else {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan untuk melihat stok');
    }
    targetBranchId = activeBranchId;
  }

  // Ambil data produk master
  const fetchProducts = !query.itemType || query.itemType === 'PRODUCT';
  const fetchMaterials = !query.itemType || query.itemType === 'MATERIAL';

  const productWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    active: true,
  };
  if (query.search) {
    productWhere.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const materialWhere: Prisma.MaterialWhereInput = {
    deletedAt: null,
    active: true,
  };
  if (query.search) {
    materialWhere.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [products, materials] = await Promise.all([
    fetchProducts ? prisma.product.findMany({ where: productWhere }) : [],
    fetchMaterials ? prisma.material.findMany({ where: materialWhere }) : [],
  ]);

  // Ambil stok di StockLevel untuk cabang target (jika targetBranchId null untuk OWNER, ambil semua)
  const stockLevelWhere: Prisma.StockLevelWhereInput = {};
  if (targetBranchId) {
    stockLevelWhere.branchId = targetBranchId;
  }
  if (query.itemType) {
    stockLevelWhere.itemType = query.itemType;
  }

  const stockLevels = await prisma.stockLevel.findMany({
    where: stockLevelWhere,
    include: {
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  const stockMap = new Map<string, { quantity: number; branchName?: string; branchCode?: string; branchId?: string }>();
  for (const sl of stockLevels) {
    const key = `${sl.branchId}_${sl.itemType}_${sl.itemId}`;
    stockMap.set(key, {
      quantity: sl.quantity,
      branchName: sl.branch.name,
      branchCode: sl.branch.code,
      branchId: sl.branch.id,
    });
  }

  // Gabungkan master + stock level
  type StockItemResult = {
    id: string;
    branchId: string | null;
    branchCode: string | null;
    branchName: string | null;
    itemType: 'PRODUCT' | 'MATERIAL';
    itemId: string;
    name: string;
    sku: string;
    unit: string;
    minStock: number;
    quantity: number;
    isLowStock: boolean;
    isStockTracked?: boolean;
  };

  const results: StockItemResult[] = [];

  // Jika targetBranchId spesifik:
  if (targetBranchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { id: true, code: true, name: true },
    });

    if (fetchProducts) {
      for (const p of products) {
        const key = `${targetBranchId}_PRODUCT_${p.id}`;
        const sl = stockMap.get(key);
        const qty = sl ? sl.quantity : 0;
        const isLow = qty < p.minStock;

        if (query.lowStock && !isLow) continue;

        results.push({
          id: p.id,
          branchId: targetBranchId,
          branchCode: branch?.code ?? null,
          branchName: branch?.name ?? null,
          itemType: 'PRODUCT',
          itemId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          minStock: p.minStock,
          quantity: qty,
          isLowStock: isLow,
        });
      }
    }

    if (fetchMaterials) {
      for (const m of materials) {
        const key = `${targetBranchId}_MATERIAL_${m.id}`;
        const sl = stockMap.get(key);
        const qty = sl ? sl.quantity : 0;
        const isLow = qty < m.minStock;

        if (query.lowStock && !isLow) continue;

        results.push({
          id: m.id,
          branchId: targetBranchId,
          branchCode: branch?.code ?? null,
          branchName: branch?.name ?? null,
          itemType: 'MATERIAL',
          itemId: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
          minStock: m.minStock,
          quantity: qty,
          isLowStock: isLow,
          isStockTracked: m.isStockTracked,
        });
      }
    }
  } else {
    // OWNER tanpa filter branch: kumpulkan per record StockLevel
    for (const sl of stockLevels) {
      if (sl.itemType === 'PRODUCT') {
        const p = products.find((prod) => prod.id === sl.itemId);
        if (!p) continue;
        const isLow = sl.quantity < p.minStock;
        if (query.lowStock && !isLow) continue;
        results.push({
          id: `${sl.branchId}_${p.id}`,
          branchId: sl.branchId,
          branchCode: sl.branch.code,
          branchName: sl.branch.name,
          itemType: 'PRODUCT',
          itemId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          minStock: p.minStock,
          quantity: sl.quantity,
          isLowStock: isLow,
        });
      } else if (sl.itemType === 'MATERIAL') {
        const m = materials.find((mat) => mat.id === sl.itemId);
        if (!m) continue;
        const isLow = sl.quantity < m.minStock;
        if (query.lowStock && !isLow) continue;
        results.push({
          id: `${sl.branchId}_${m.id}`,
          branchId: sl.branchId,
          branchCode: sl.branch.code,
          branchName: sl.branch.name,
          itemType: 'MATERIAL',
          itemId: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
          minStock: m.minStock,
          quantity: sl.quantity,
          isLowStock: isLow,
          isStockTracked: m.isStockTracked,
        });
      }
    }
  }

  // Sort by name
  results.sort((a, b) => a.name.localeCompare(b.name));

  const total = results.length;
  const page = query.page;
  const limit = query.limit;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedData = results.slice((page - 1) * limit, page * limit);

  return {
    data: paginatedData,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/**
 * GET /api/v1/inventory/stock/:itemType/:itemId/movements
 * Kartu stok per item per cabang
 */
export async function getStockMovements(
  itemType: 'PRODUCT' | 'MATERIAL',
  itemId: string,
  query: MovementListQueryInput,
  role: UserRole,
  activeBranchId: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = query.branchId ?? activeBranchId ?? null;
  } else {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan untuk melihat kartu stok');
    }
    targetBranchId = activeBranchId;
  }

  if (!targetBranchId) {
    throw new ValidationError('Cabang harus ditentukan untuk melihat kartu stok');
  }

  // Verifikasi item exist
  let itemName = '';
  let itemSku = '';
  let itemUnit = '';

  if (itemType === 'PRODUCT') {
    const product = await prisma.product.findUnique({ where: { id: itemId } });
    if (!product || product.deletedAt) {
      throw new NotFoundError('Produk tidak ditemukan');
    }
    itemName = product.name;
    itemSku = product.sku;
    itemUnit = product.unit;
  } else {
    const material = await prisma.material.findUnique({ where: { id: itemId } });
    if (!material || material.deletedAt) {
      throw new NotFoundError('Bahan tidak ditemukan');
    }
    itemName = material.name;
    itemSku = material.sku;
    itemUnit = material.unit;
  }

  const where: Prisma.InventoryMovementWhereInput = {
    branchId: targetBranchId,
    itemType,
    itemId,
  };

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      where.createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      where.createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
    }
  }

  const [total, movements, currentStock] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.stockLevel.findUnique({
      where: {
        branchId_itemType_itemId: {
          branchId: targetBranchId,
          itemType,
          itemId,
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / query.limit) || 1;

  return {
    item: {
      id: itemId,
      itemType,
      name: itemName,
      sku: itemSku,
      unit: itemUnit,
      currentQuantity: currentStock?.quantity ?? 0,
    },
    data: movements.map((m) => ({
      id: m.id,
      branchId: m.branchId,
      itemType: m.itemType,
      itemId: m.itemId,
      quantityDelta: m.quantityDelta,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      notes: m.notes,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    },
  };
}

/**
 * POST /api/v1/inventory/stock-in
 * Barang masuk multi-item sekaligus (atomik)
 */
export async function stockIn(
  input: StockInInput,
  userId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  if (!activeBranchId) {
    throw new ValidationError('Branch aktif diperlukan untuk penerimaan barang masuk');
  }

  // Verifikasi cabang
  const branch = await prisma.branch.findUnique({ where: { id: activeBranchId } });
  if (!branch || !branch.active) {
    throw new ValidationError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  // Verifikasi semua itemId di master
  if (input.itemType === 'PRODUCT') {
    for (const it of input.items) {
      const prod = await prisma.product.findUnique({ where: { id: it.itemId } });
      if (!prod || prod.deletedAt || !prod.active) {
        throw new NotFoundError(`Produk dengan ID "${it.itemId}" tidak ditemukan atau nonaktif`);
      }
    }
  } else {
    for (const it of input.items) {
      const mat = await prisma.material.findUnique({ where: { id: it.itemId } });
      if (!mat || mat.deletedAt || !mat.active) {
        throw new NotFoundError(`Bahan dengan ID "${it.itemId}" tidak ditemukan atau nonaktif`);
      }
    }
  }

  // Eksekusi atomik
  const result = await prisma.$transaction(async (tx) => {
    const createdMovements = [];

    for (const it of input.items) {
      // 1. Update StockLevel
      const stockLevel = await tx.stockLevel.upsert({
        where: {
          branchId_itemType_itemId: {
            branchId: activeBranchId,
            itemType: input.itemType,
            itemId: it.itemId,
          },
        },
        create: {
          branchId: activeBranchId,
          itemType: input.itemType,
          itemId: it.itemId,
          quantity: it.quantity,
        },
        update: {
          quantity: { increment: it.quantity },
        },
      });

      // Format notes (D-I1: include unitCost if provided)
      let notes = input.note || null;
      if (it.unitCost !== undefined) {
        const costStr = `[Biaya: Rp ${it.unitCost}]`;
        notes = notes ? `${costStr} ${notes}` : costStr;
      }

      // 2. Catat InventoryMovement
      const movement = await tx.inventoryMovement.create({
        data: {
          branchId: activeBranchId,
          itemType: input.itemType,
          productId: input.itemType === 'PRODUCT' ? it.itemId : null,
          materialId: input.itemType === 'MATERIAL' ? it.itemId : null,
          itemId: it.itemId,
          quantityDelta: it.quantity,
          referenceType: 'STOCK_IN',
          notes,
          createdBy: userId,
        },
      });

      createdMovements.push({
        movementId: movement.id,
        itemId: it.itemId,
        quantityDelta: it.quantity,
        currentStock: stockLevel.quantity,
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'CREATE',
        entity: 'StockIn',
        entityId: createdMovements[0]?.movementId ?? activeBranchId,
        after: {
          branchId: activeBranchId,
          itemType: input.itemType,
          itemCount: input.items.length,
          note: input.note,
        },
        ip,
        note: `Stock-in ${input.items.length} item ${input.itemType}`,
      },
    });

    return createdMovements;
  });

  return {
    branchId: activeBranchId,
    itemType: input.itemType,
    items: result,
  };
}

/**
 * GET /api/v1/stock-opnames
 * List stock opname per branch
 */
export async function listStockOpnames(
  query: StockOpnameListQueryInput,
  role: UserRole,
  activeBranchId: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = query.branchId ?? activeBranchId ?? null;
  } else {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan untuk melihat data stock opname');
    }
    targetBranchId = activeBranchId;
  }

  const where: Prisma.StockOpnameWhereInput = {};
  if (targetBranchId) {
    where.branchId = targetBranchId;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.dateFrom || query.dateTo) {
    where.opnameDate = {};
    if (query.dateFrom) {
      where.opnameDate.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      where.opnameDate.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
    }
  }

  const [total, opnames] = await Promise.all([
    prisma.stockOpname.count({ where }),
    prisma.stockOpname.findMany({
      where,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        items: true,
      },
      orderBy: { opnameDate: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const totalPages = Math.ceil(total / query.limit) || 1;

  return {
    data: opnames.map((o) => ({
      id: o.id,
      branchId: o.branchId,
      branchCode: o.branch.code,
      branchName: o.branch.name,
      opnameDate: o.opnameDate.toISOString().split('T')[0],
      status: o.status,
      itemCount: o.items.length,
      submittedAt: o.submittedAt ? o.submittedAt.toISOString() : null,
      submittedBy: o.submittedBy,
      createdAt: o.createdAt.toISOString(),
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    },
  };
}

/**
 * POST /api/v1/stock-opnames
 * Create DRAFT Stock Opname + snapshot systemQty semua item aktif branch
 */
export async function createStockOpname(
  input: CreateStockOpnameInput,
  userId: string,
  role: UserRole,
  activeBranchId: string | null
) {
  if (!activeBranchId) {
    throw new ValidationError('Branch aktif diperlukan untuk membuat stock opname');
  }

  const opnameDateObj = new Date(`${input.opnameDate}T00:00:00.000Z`);

  // Unique check: 1 opname per branch per date
  const existing = await prisma.stockOpname.findUnique({
    where: {
      branchId_opnameDate: {
        branchId: activeBranchId,
        opnameDate: opnameDateObj,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      'Sudah ada stock opname untuk cabang dan tanggal ini',
      'DUPLICATE'
    );
  }

  // Snapshot master items & current StockLevel
  const items =
    input.itemType === 'PRODUCT'
      ? await prisma.product.findMany({ where: { deletedAt: null, active: true } })
      : await prisma.material.findMany({ where: { deletedAt: null, active: true } });

  const stockLevels = await prisma.stockLevel.findMany({
    where: {
      branchId: activeBranchId,
      itemType: input.itemType,
    },
  });

  const stockMap = new Map<string, number>();
  for (const sl of stockLevels) {
    stockMap.set(sl.itemId, sl.quantity);
  }

  const opnameItemsData = items.map((item) => {
    const sysQty = stockMap.get(item.id) ?? 0;
    return {
      itemType: input.itemType,
      itemId: item.id,
      systemQty: sysQty,
      physicalQty: sysQty, // Default awal sama dengan systemQty
      note: input.note || null,
    };
  });

  const created = await prisma.stockOpname.create({
    data: {
      branchId: activeBranchId,
      opnameDate: opnameDateObj,
      status: 'DRAFT',
      items: {
        create: opnameItemsData,
      },
    },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      items: true,
    },
  });

  return {
    id: created.id,
    branchId: created.branchId,
    branchCode: created.branch.code,
    branchName: created.branch.name,
    opnameDate: created.opnameDate.toISOString().split('T')[0],
    status: created.status,
    itemType: input.itemType,
    items: created.items.map((it) => ({
      id: it.id,
      itemId: it.itemId,
      itemType: it.itemType,
      systemQty: it.systemQty,
      physicalQty: it.physicalQty,
      note: it.note,
    })),
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * GET /api/v1/stock-opnames/:id
 * Detail stock opname + items
 */
export async function getStockOpnameById(
  id: string,
  role: UserRole,
  activeBranchId: string | null
) {
  const opname = await prisma.stockOpname.findUnique({
    where: { id },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      items: true,
    },
  });

  if (!opname) {
    throw new NotFoundError('Stock opname tidak ditemukan');
  }

  if (role !== 'OWNER' && opname.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk stock opname cabang lain');
  }

  // Join nama item dari master
  const itemIds = opname.items.map((i) => i.itemId);
  const [products, materials] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: itemIds } } }),
    prisma.material.findMany({ where: { id: { in: itemIds } } }),
  ]);

  const nameMap = new Map<string, { name: string; sku: string; unit: string }>();
  for (const p of products) nameMap.set(p.id, { name: p.name, sku: p.sku, unit: p.unit });
  for (const m of materials) nameMap.set(m.id, { name: m.name, sku: m.sku, unit: m.unit });

  return {
    id: opname.id,
    branchId: opname.branchId,
    branchCode: opname.branch.code,
    branchName: opname.branch.name,
    opnameDate: opname.opnameDate.toISOString().split('T')[0],
    status: opname.status,
    submittedAt: opname.submittedAt ? opname.submittedAt.toISOString() : null,
    submittedBy: opname.submittedBy,
    items: opname.items.map((it) => {
      const meta = nameMap.get(it.itemId);
      return {
        id: it.id,
        itemId: it.itemId,
        name: meta?.name ?? '',
        sku: meta?.sku ?? '',
        unit: meta?.unit ?? '',
        itemType: it.itemType,
        systemQty: it.systemQty,
        physicalQty: it.physicalQty,
        difference: it.physicalQty - it.systemQty,
        note: it.note,
      };
    }),
    createdAt: opname.createdAt.toISOString(),
  };
}

/**
 * PATCH /api/v1/stock-opnames/:id
 * Edit DRAFT stock opname (REPLACE physicalQty dan note pada items)
 */
export async function updateStockOpname(
  id: string,
  input: UpdateStockOpnameInput,
  role: UserRole,
  activeBranchId: string | null
) {
  const existing = await prisma.stockOpname.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    throw new NotFoundError('Stock opname tidak ditemukan');
  }

  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk stock opname cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Hanya stock opname berstatus DRAFT yang dapat diedit',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // Update physicalQty & note per item
  await prisma.$transaction(async (tx) => {
    for (const updateIt of input.items) {
      const itemRow = existing.items.find((i) => i.itemId === updateIt.itemId);
      if (itemRow) {
        await tx.stockOpnameItem.update({
          where: { id: itemRow.id },
          data: {
            physicalQty: updateIt.physicalQty,
            note: updateIt.note !== undefined ? updateIt.note : itemRow.note,
          },
        });
      }
    }
  });

  return getStockOpnameById(id, role, activeBranchId);
}

/**
 * POST /api/v1/stock-opnames/:id/submit
 * Finalisasi DRAFT -> SUBMITTED (Atomik update StockLevel & create InventoryMovement OPNAME)
 */
export async function submitStockOpname(
  id: string,
  userId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  const existing = await prisma.stockOpname.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    throw new NotFoundError('Stock opname tidak ditemukan');
  }

  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk stock opname cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Stock opname sudah di-submit sebelumnya',
      'INVALID_TRANSACTION_STATE'
    );
  }

  // Eksekusi atomik
  await prisma.$transaction(async (tx) => {
    // 1. Verifikasi apakah ada item yang penyesuaiannya membuat stok menjadi negatif
    for (const it of existing.items) {
      const delta = it.physicalQty - it.systemQty;
      if (delta === 0) continue;

      const currentStock = await tx.stockLevel.findUnique({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: it.itemType,
            itemId: it.itemId,
          },
        },
      });

      const currentQty = currentStock ? currentStock.quantity : 0;
      const targetQty = currentQty + delta;

      if (targetQty < 0) {
        throw new ConflictError(
          `Penyesuaian stok opname menyebabkan stok negatif untuk item ID "${it.itemId}" (stok saat ini: ${currentQty}, delta: ${delta})`,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    // 2. Terapkan penyesuaian delta ke StockLevel dan buat InventoryMovement
    for (const it of existing.items) {
      const delta = it.physicalQty - it.systemQty;
      if (delta === 0) continue; // D-I3: delta 0 tanpa movement row

      await tx.stockLevel.upsert({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: it.itemType,
            itemId: it.itemId,
          },
        },
        create: {
          branchId: existing.branchId,
          itemType: it.itemType,
          itemId: it.itemId,
          quantity: it.physicalQty,
        },
        update: {
          quantity: { increment: delta },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          branchId: existing.branchId,
          itemType: it.itemType,
          productId: it.itemType === 'PRODUCT' ? it.itemId : null,
          materialId: it.itemType === 'MATERIAL' ? it.itemId : null,
          itemId: it.itemId,
          quantityDelta: delta,
          referenceType: 'OPNAME',
          referenceId: existing.id,
          notes: it.note || 'Penyesuaian hasil stock opname',
          createdBy: userId,
        },
      });
    }

    // 3. Kunci status menjadi SUBMITTED
    await tx.stockOpname.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
      },
    });

    // 4. Catat Audit Log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'UPDATE',
        entity: 'StockOpname',
        entityId: id,
        after: {
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          submittedBy: userId,
        },
        ip,
        note: 'STOCK_OPNAME_SUBMITTED',
      },
    });
  });

  return getStockOpnameById(id, role, activeBranchId);
}
