import { Prisma, type UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
  InsufficientStockError,
} from '@/lib/errors';
import type {
  StockInInput,
  StockOutInput,
  StockListQueryInput,
  MovementListQueryInput,
  CreateStockOpnameInput,
  UpdateStockOpnameInput,
  StockOpnameListQueryInput,
} from '@/lib/validations/inventory.schema';

/**
 * GET /api/v1/inventory/stock
 * Menampilkan daftar stok bahan medis per cabang + master join + minStock comparison
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

  const materials = await prisma.material.findMany({
    where: materialWhere,
    orderBy: { name: 'asc' },
  });

  // Ambil stok di StockLevel untuk cabang target (jika targetBranchId null untuk OWNER, ambil semua)
  const stockLevelWhere: Prisma.StockLevelWhereInput = {
    itemType: 'MATERIAL',
  };
  if (targetBranchId) {
    stockLevelWhere.branchId = targetBranchId;
  }

  const stockLevels = await prisma.stockLevel.findMany({
    where: stockLevelWhere,
    include: {
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  const stockMap = new Map<string, { quantity: number; branchName?: string; branchCode?: string; branchId?: string }>();
  for (const sl of stockLevels) {
    const key = `${sl.branchId}_MATERIAL_${sl.itemId}`;
    stockMap.set(key, {
      quantity: sl.quantity,
      branchName: sl.branch.name,
      branchCode: sl.branch.code,
      branchId: sl.branch.id,
    });
  }

  type StockItemResult = {
    id: string;
    branchId: string | null;
    branchCode: string | null;
    branchName: string | null;
    itemType: 'MATERIAL';
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
  } else {
    // OWNER tanpa filter branch: kumpulkan per record StockLevel
    for (const sl of stockLevels) {
      const m = materials.find((mat) => mat.id === sl.itemId);
      if (!m) continue;
      const isLow = sl.quantity < m.minStock;
      if (query.lowStock && !isLow) continue;

      results.push({
        id: m.id,
        branchId: sl.branch.id,
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

  // Pagination in-memory
  const total = results.length;
  const skip = (query.page - 1) * query.limit;
  const paginated = results.slice(skip, skip + query.limit);

  return {
    data: paginated,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * GET /api/v1/inventory/stock/:itemType/:itemId/movements
 * Kartu stok per item per cabang (Khusus Bahan Medis)
 */
export async function getStockMovements(
  _itemType: string,
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

  // Verifikasi bahan exist
  const material = await prisma.material.findUnique({ where: { id: itemId } });
  if (!material || material.deletedAt) {
    throw new NotFoundError('Bahan tidak ditemukan');
  }
  const itemName = material.name;
  const itemSku = material.sku;
  const itemUnit = material.unit;

  const where: Prisma.InventoryMovementWhereInput = {
    branchId: targetBranchId,
    itemType: 'MATERIAL',
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
          itemType: 'MATERIAL',
          itemId,
        },
      },
    }),
  ]);

  return {
    item: {
      itemId,
      itemType: 'MATERIAL',
      name: itemName,
      sku: itemSku,
      unit: itemUnit,
      currentQuantity: currentStock?.quantity ?? 0,
    },
    data: movements.map((m) => ({
      id: m.id,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      quantityDelta: m.quantityDelta,
      notes: m.notes,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * POST /api/v1/inventory/stock-in
 * Catat penerimaan barang masuk (Stock In)
 * Pola Tugas 4: role non-OWNER -> abaikan input.branchId, selalu gunakan activeBranchId.
 * OWNER -> gunakan input.branchId, fallback ke activeBranchId.
 */
export async function stockIn(
  input: StockInInput,
  userId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = input.branchId ?? activeBranchId ?? null;
  } else {
    targetBranchId = activeBranchId; // non-OWNER: input client diabaikan
  }

  if (!targetBranchId) {
    throw new ValidationError('Branch aktif atau branchId diperlukan untuk penerimaan barang masuk');
  }

  // Verifikasi cabang
  const branch = await prisma.branch.findUnique({ where: { id: targetBranchId } });
  if (!branch || !branch.active) {
    throw new ValidationError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  // Verifikasi semua itemId di master material
  for (const it of input.items) {
    const mat = await prisma.material.findUnique({ where: { id: it.itemId } });
    if (!mat || mat.deletedAt || !mat.active) {
      throw new NotFoundError(`Bahan dengan ID "${it.itemId}" tidak ditemukan atau nonaktif`);
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
            branchId: targetBranchId!,
            itemType: 'MATERIAL',
            itemId: it.itemId,
          },
        },
        create: {
          branchId: targetBranchId!,
          itemType: 'MATERIAL',
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
          branchId: targetBranchId!,
          itemType: 'MATERIAL',
          materialId: it.itemId,
          itemId: it.itemId,
          quantityDelta: it.quantity,
          unitCost: it.unitCost, // Tambahan: simpan ke kolom db
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
        entityId: createdMovements[0]?.movementId ?? targetBranchId!,
        after: {
          branchId: targetBranchId,
          itemType: 'MATERIAL',
          itemCount: input.items.length,
          note: input.note,
        },
        ip,
        note: `Stock-in ${input.items.length} item material`,
      },
    });

    return {
      branchId: targetBranchId,
      movements: createdMovements,
    };
  });

  return result;
}

/**
 * POST /api/v1/inventory/stock-out
 * Catat pengeluaran stok bahan manual (MANUAL_ADJUSTMENT, DAMAGE, EXPIRED).
 * Pola Tugas 4: role non-OWNER -> abaikan input.branchId, selalu gunakan activeBranchId.
 * OWNER -> gunakan input.branchId, fallback ke activeBranchId.
 * Kurang stok -> 409 INSUFFICIENT_STOCK.
 */
export async function stockOut(
  input: StockOutInput,
  userId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = input.branchId ?? activeBranchId ?? null;
  } else {
    targetBranchId = activeBranchId; // non-OWNER: input client diabaikan
  }

  if (!targetBranchId) {
    throw new ValidationError('Branch aktif atau branchId diperlukan untuk pengeluaran barang');
  }

  // Verifikasi cabang
  const branch = await prisma.branch.findUnique({ where: { id: targetBranchId } });
  if (!branch || !branch.active) {
    throw new ValidationError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  // Verifikasi semua itemId di master material
  for (const it of input.items) {
    const mat = await prisma.material.findUnique({ where: { id: it.itemId } });
    if (!mat || mat.deletedAt || !mat.active) {
      throw new NotFoundError(`Bahan dengan ID "${it.itemId}" tidak ditemukan atau nonaktif`);
    }
  }

  // Eksekusi atomik
  const result = await prisma.$transaction(async (tx) => {
    const createdMovements = [];

    for (const it of input.items) {
      // Cek ketersediaan stok di StockLevel
      const stock = await tx.stockLevel.findUnique({
        where: {
          branchId_itemType_itemId: {
            branchId: targetBranchId!,
            itemType: 'MATERIAL',
            itemId: it.itemId,
          },
        },
      });

      const currentQty = stock?.quantity ?? 0;
      if (currentQty < it.quantity) {
        const mat = await tx.material.findUnique({ where: { id: it.itemId } });
        throw new InsufficientStockError(
          `Stok untuk bahan "${mat?.name || it.itemId}" tidak mencukupi (tersedia: ${currentQty}, diminta: ${it.quantity})`
        );
      }

      // 1. Kurangi stok di StockLevel
      const updatedStock = await tx.stockLevel.update({
        where: {
          branchId_itemType_itemId: {
            branchId: targetBranchId!,
            itemType: 'MATERIAL',
            itemId: it.itemId,
          },
        },
        data: {
          quantity: { decrement: it.quantity },
        },
      });

      // 2. Catat InventoryMovement dengan quantityDelta negatif
      const movement = await tx.inventoryMovement.create({
        data: {
          branchId: targetBranchId!,
          itemType: 'MATERIAL',
          materialId: it.itemId,
          itemId: it.itemId,
          quantityDelta: -it.quantity,
          referenceType: it.reasonType,
          notes: input.note || null,
          createdBy: userId,
        },
      });

      createdMovements.push({
        movementId: movement.id,
        itemId: it.itemId,
        quantityDelta: -it.quantity,
        currentStock: updatedStock.quantity,
        reasonType: it.reasonType,
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'CREATE',
        entity: 'StockOut',
        entityId: createdMovements[0]?.movementId ?? targetBranchId!,
        after: {
          branchId: targetBranchId,
          itemType: 'MATERIAL',
          itemCount: input.items.length,
          note: input.note,
          movements: createdMovements,
        },
        ip,
        note: `Stock-out ${input.items.length} item material`,
      },
    });

    return {
      branchId: targetBranchId,
      movements: createdMovements,
    };
  });

  return result;
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
      throw new ValidationError('Branch aktif diperlukan untuk melihat stock opname');
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
      where.opnameDate.lte = new Date(`${query.dateTo}T00:00:00.000Z`);
    }
  }

  const [total, data] = await Promise.all([
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

  const totalPages = Math.ceil(total / query.limit);

  return {
    data: data.map((op) => ({
      id: op.id,
      branchId: op.branchId,
      branchCode: op.branch.code,
      branchName: op.branch.name,
      opnameDate: op.opnameDate.toISOString().split('T')[0],
      status: op.status,
      totalItems: op.items.length,
      submittedAt: op.submittedAt ? op.submittedAt.toISOString() : null,
      submittedBy: op.submittedBy,
      createdAt: op.createdAt.toISOString(),
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
 * Create DRAFT Stock Opname + snapshot systemQty semua bahan aktif branch
 */
export async function createStockOpname(
  input: CreateStockOpnameInput,
  userId: string,
  role: UserRole,
  activeBranchId: string | null
) {
  let targetBranchId: string | null = null;
  if (role === 'OWNER') {
    targetBranchId = input.branchId ?? activeBranchId ?? null;
  } else {
    targetBranchId = activeBranchId; // non-OWNER: input client diabaikan
  }

  if (!targetBranchId) {
    throw new ValidationError('Branch aktif atau branchId diperlukan untuk membuat stock opname');
  }

  const opnameDateObj = new Date(`${input.opnameDate}T00:00:00.000Z`);

  // Unique check: 1 opname per branch per date
  const existing = await prisma.stockOpname.findUnique({
    where: {
      branchId_opnameDate: {
        branchId: targetBranchId,
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

  // Snapshot master materials & current StockLevel
  const materials = await prisma.material.findMany({ where: { deletedAt: null, active: true } });

  const stockLevels = await prisma.stockLevel.findMany({
    where: {
      branchId: targetBranchId,
      itemType: 'MATERIAL',
    },
  });

  const stockMap = new Map<string, number>();
  for (const sl of stockLevels) {
    stockMap.set(sl.itemId, sl.quantity);
  }

  const opnameItemsData = materials.map((item) => {
    const sysQty = stockMap.get(item.id) ?? 0;
    return {
      itemType: 'MATERIAL' as const,
      itemId: item.id,
      systemQty: sysQty,
      physicalQty: sysQty, // Default awal sama dengan systemQty
      note: input.note || null,
    };
  });

  const created = await prisma.stockOpname.create({
    data: {
      branchId: targetBranchId,
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
    itemType: 'MATERIAL',
    items: created.items.map((it) => ({
      id: it.id,
      itemId: it.itemId,
      systemQty: it.systemQty,
      physicalQty: it.physicalQty,
      difference: 0,
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

  // Join nama item dari master material
  const itemIds = opname.items.map((i) => i.itemId);
  const materials = await prisma.material.findMany({ where: { id: { in: itemIds } } });

  const nameMap = new Map<string, { name: string; sku: string; unit: string }>();
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
      'OPNAME_ALREADY_SUBMITTED'
    );
  }

  // Update physicalQty and note per item
  await prisma.$transaction(async (tx) => {
    for (const updateItem of input.items) {
      await tx.stockOpnameItem.updateMany({
        where: {
          opnameId: id,
          itemId: updateItem.itemId,
        },
        data: {
          physicalQty: updateItem.physicalQty,
          note: updateItem.note || null,
        },
      });
    }
  });

  return getStockOpnameById(id, role, activeBranchId);
}

/**
 * POST /api/v1/stock-opnames/:id/submit
 * Submit stock opname: kunci status, terapkan delta ke StockLevel, buat InventoryMovement
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

  if (existing.status === 'SUBMITTED') {
    throw new ConflictError(
      'Stock opname sudah di-submit dan tidak dapat diubah lagi',
      'OPNAME_ALREADY_SUBMITTED'
    );
  }

  // Eksekusi atomik dalam $transaction
  await prisma.$transaction(async (tx) => {
    // 1. Validasi stok akhir tidak boleh negatif
    for (const it of existing.items) {
      if (it.physicalQty < 0) {
        throw new ValidationError(
          `Stok fisik untuk item ${it.itemId} tidak boleh bernilai negatif`
        );
      }
    }

    // 2. Terapkan penyesuaian delta ke StockLevel dan buat InventoryMovement
    for (const it of existing.items) {
      const delta = it.physicalQty - it.systemQty;
      if (delta === 0) continue; // D-I3: delta 0 tanpa movement row

      // Periksa saldo aktual saat ini agar tidak negatif
      const currentLevel = await tx.stockLevel.findUnique({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: it.itemType,
            itemId: it.itemId,
          },
        },
      });

      const currentQty = currentLevel?.quantity ?? 0;
      if (currentQty + delta < 0) {
        throw new ConflictError(
          `Penyesuaian opname untuk item ${it.itemId} menghasilkan stok negatif (${currentQty + delta}). Transaksi dibatalkan.`,
          'INSUFFICIENT_STOCK'
        );
      }

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
          materialId: it.itemId,
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
