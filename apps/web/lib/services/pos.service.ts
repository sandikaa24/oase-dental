import { prisma } from '../prisma';
import { Prisma, type UserRole, type TransactionStatus } from '@prisma/client';
import {
  ClosingPeriodLockedError,
  ConflictError,
  ForbiddenError,
  InsufficientStockError,
  NotFoundError,
  ValidationError,
} from '../errors';
import { getJakartaDateTime } from './attendance.service';

/**
 * Format output transaksi yang aman untuk JSON (semua Decimal diserialisasi ke string,
 * dan itemType dikembalikan sesuai jenis aslinya SERVICE atau PRODUCT).
 */
export function serializeTransaction<
  T extends {
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    items?: Array<{
      id: string;
      itemType: string;
      serviceId: string | null;
      productId: string | null;
      itemId: string;
      name: string;
      nameEn: string | null;
      unit: string | null;
      price: Prisma.Decimal;
      quantity: number;
      lineTotal: Prisma.Decimal;
    }>;
    payments?: Array<{
      id: string;
      method: string;
      amount: Prisma.Decimal;
    }>;
  }
>(trx: T) {
  return {
    ...trx,
    subtotal: trx.subtotal.toString(),
    discountAmount: trx.discountAmount.toString(),
    total: trx.total.toString(),
    items: trx.items?.map((item) => ({
      ...item,
      itemType: item.serviceId ? 'SERVICE' : 'PRODUCT',
      price: item.price.toString(),
      lineTotal: item.lineTotal.toString(),
    })),
    payments: trx.payments?.map((p) => ({
      ...p,
      amount: p.amount.toString(),
    })),
  };
}

const transactionInclude = {
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  items: true,
  payments: true,
} as const;

/**
 * POST /transactions
 * Create DRAFT Transaksi
 * - Snapshot harga dan nama dari master database
 * - Hitung subtotal = sum(price * qty) dan total = subtotal - discount
 * - Tidak memotong stok saat DRAFT
 */
export async function createTransaction(
  input: {
    items: Array<{
      itemType: 'SERVICE' | 'PRODUCT';
      itemId: string;
      quantity: number;
    }>;
    patientName?: string | null;
    patientPhone?: string | null;
    discountAmount?: string;
    discountReason?: string | null;
  },
  branchId: string | null,
  cashierId: string
) {
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk membuat transaksi');
  }

  // Verifikasi cabang aktif
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
  });
  if (!branch || !branch.active) {
    throw new ValidationError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  const { dateStr } = getJakartaDateTime();

  // Siapkan dan snapshot setiap item dari database
  let subtotal = new Prisma.Decimal(0);
  const resolvedItems: Array<{
    itemType: 'PRODUCT';
    serviceId: string | null;
    productId: string | null;
    itemId: string;
    name: string;
    nameEn: string | null;
    unit: string | null;
    price: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }> = [];

  for (const item of input.items) {
    if (item.itemType === 'SERVICE') {
      const service = await prisma.service.findUnique({
        where: { id: item.itemId },
      });
      if (!service || !service.active || service.deletedAt !== null) {
        throw new ValidationError(
          `Layanan dengan ID ${item.itemId} tidak ditemukan atau sudah tidak aktif`
        );
      }
      const lineTotal = service.price.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      resolvedItems.push({
        itemType: 'PRODUCT', // diisi enum schema
        serviceId: service.id,
        productId: null,
        itemId: service.id,
        name: service.name,
        nameEn: service.nameEn,
        unit: null,
        price: service.price,
        quantity: item.quantity,
        lineTotal,
      });
    } else {
      const product = await prisma.product.findUnique({
        where: { id: item.itemId },
      });
      if (!product || !product.active || product.deletedAt !== null) {
        throw new ValidationError(
          `Produk dengan ID ${item.itemId} tidak ditemukan atau sudah tidak aktif`
        );
      }
      const lineTotal = product.sellPrice.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      resolvedItems.push({
        itemType: 'PRODUCT',
        serviceId: null,
        productId: product.id,
        itemId: product.id,
        name: product.name,
        nameEn: null,
        unit: product.unit,
        price: product.sellPrice,
        quantity: item.quantity,
        lineTotal,
      });
    }
  }

  const discount = new Prisma.Decimal(input.discountAmount || '0');
  if (discount.lessThan(0)) {
    throw new ValidationError('Potongan diskon tidak boleh bernilai negatif');
  }
  let total = subtotal.sub(discount);
  if (total.lessThan(0)) {
    total = new Prisma.Decimal(0);
  }

  // Placeholder transaction number untuk DRAFT
  const dateCompact = dateStr.replace(/-/g, '');
  const tempNumber = `DRAFT-${dateCompact}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const transaction = await prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.create({
      data: {
        transactionNumber: tempNumber,
        branchId,
        cashierId,
        patientName: input.patientName ?? null,
        patientPhone: input.patientPhone ?? null,
        status: 'DRAFT',
        subtotal,
        discountAmount: discount,
        discountReason: discount.greaterThan(0) ? input.discountReason : null,
        total,
        transactionDate: new Date(),
        items: {
          create: resolvedItems,
        },
      },
      include: transactionInclude,
    });

    return trx;
  });

  return serializeTransaction(transaction);
}

/**
 * GET /transactions
 * List transaksi branch aktif dengan filter
 */
export async function listTransactions(
  params: {
    page: number;
    limit: number;
    status?: TransactionStatus;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    cashierId?: string;
    branchId?: string;
    search?: string;
  },
  role: UserRole,
  activeBranchId: string | null
) {
  const where: Prisma.TransactionWhereInput = {};

  // CASHIER terkunci pada activeBranchId
  if (role !== 'OWNER') {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan untuk melihat transaksi');
    }
    where.branchId = activeBranchId;
  } else if (params.branchId) {
    where.branchId = params.branchId;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.cashierId) {
    where.cashierId = params.cashierId;
  }

  if (params.search) {
    where.transactionNumber = {
      contains: params.search,
      mode: 'insensitive',
    };
  }

  if (params.date) {
    const d = new Date(`${params.date}T00:00:00.000Z`);
    const nextD = new Date(d);
    nextD.setUTCDate(nextD.getUTCDate() + 1);
    where.transactionDate = {
      gte: d,
      lt: nextD,
    };
  } else if (params.dateFrom || params.dateTo) {
    where.transactionDate = {};
    if (params.dateFrom) {
      where.transactionDate.gte = new Date(`${params.dateFrom}T00:00:00.000Z`);
    }
    if (params.dateTo) {
      const to = new Date(`${params.dateTo}T00:00:00.000Z`);
      to.setUTCDate(to.getUTCDate() + 1);
      where.transactionDate.lt = to;
    }
  }

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data: data.map(serializeTransaction),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

/**
 * GET /transactions/:id
 * Detail transaksi + IDOR guard
 */
export async function getTransactionById(
  id: string,
  role: UserRole,
  activeBranchId: string | null
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: transactionInclude,
  });

  if (!transaction) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  // IDOR Guard: non-OWNER hanya boleh akses cabang aktifnya
  if (role !== 'OWNER' && transaction.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk transaksi cabang lain');
  }

  return serializeTransaction(transaction);
}

/**
 * PATCH /transactions/:id
 * Edit DRAFT transaksi saja
 */
export async function updateTransaction(
  id: string,
  input: {
    items?: Array<{
      itemType: 'SERVICE' | 'PRODUCT';
      itemId: string;
      quantity: number;
    }>;
    patientName?: string | null;
    patientPhone?: string | null;
    discountAmount?: string;
    discountReason?: string | null;
  },
  role: UserRole,
  activeBranchId: string | null
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk transaksi cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Hanya transaksi berstatus DRAFT yang dapat diedit',
      'INVALID_TRANSACTION_STATE'
    );
  }

  let subtotal = existing.subtotal;
  let resolvedItems: Array<{
    itemType: 'PRODUCT';
    serviceId: string | null;
    productId: string | null;
    itemId: string;
    name: string;
    nameEn: string | null;
    unit: string | null;
    price: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }> | null = null;

  if (input.items !== undefined) {
    subtotal = new Prisma.Decimal(0);
    resolvedItems = [];

    for (const item of input.items) {
      if (item.itemType === 'SERVICE') {
        const service = await prisma.service.findUnique({
          where: { id: item.itemId },
        });
        if (!service || !service.active || service.deletedAt !== null) {
          throw new ValidationError(
            `Layanan dengan ID ${item.itemId} tidak ditemukan atau sudah tidak aktif`
          );
        }
        const lineTotal = service.price.mul(item.quantity);
        subtotal = subtotal.add(lineTotal);
        resolvedItems.push({
          itemType: 'PRODUCT',
          serviceId: service.id,
          productId: null,
          itemId: service.id,
          name: service.name,
          nameEn: service.nameEn,
          unit: null,
          price: service.price,
          quantity: item.quantity,
          lineTotal,
        });
      } else {
        const product = await prisma.product.findUnique({
          where: { id: item.itemId },
        });
        if (!product || !product.active || product.deletedAt !== null) {
          throw new ValidationError(
            `Produk dengan ID ${item.itemId} tidak ditemukan atau sudah tidak aktif`
          );
        }
        const lineTotal = product.sellPrice.mul(item.quantity);
        subtotal = subtotal.add(lineTotal);
        resolvedItems.push({
          itemType: 'PRODUCT',
          serviceId: null,
          productId: product.id,
          itemId: product.id,
          name: product.name,
          nameEn: null,
          unit: product.unit,
          price: product.sellPrice,
          quantity: item.quantity,
          lineTotal,
        });
      }
    }
  }

  const discount =
    input.discountAmount !== undefined
      ? new Prisma.Decimal(input.discountAmount || '0')
      : existing.discountAmount;

  if (discount.lessThan(0)) {
    throw new ValidationError('Potongan diskon tidak boleh bernilai negatif');
  }

  let total = subtotal.sub(discount);
  if (total.lessThan(0)) {
    total = new Prisma.Decimal(0);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (resolvedItems) {
      // Hapus item lama dan buat baru
      await tx.transactionItem.deleteMany({
        where: { transactionId: id },
      });
      await tx.transactionItem.createMany({
        data: resolvedItems.map((item) => ({
          ...item,
          transactionId: id,
        })),
      });
    }

    const res = await tx.transaction.update({
      where: { id },
      data: {
        patientName: input.patientName !== undefined ? input.patientName : existing.patientName,
        patientPhone: input.patientPhone !== undefined ? input.patientPhone : existing.patientPhone,
        subtotal,
        discountAmount: discount,
        discountReason:
          discount.greaterThan(0)
            ? input.discountReason !== undefined
              ? input.discountReason
              : existing.discountReason
            : null,
        total,
      },
      include: transactionInclude,
    });

    return res;
  });

  return serializeTransaction(updated);
}

/**
 * DELETE /transactions/:id
 * Hapus transaksi DRAFT
 */
export async function deleteTransaction(
  id: string,
  role: UserRole,
  activeBranchId: string | null
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk transaksi cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Hanya transaksi berstatus DRAFT yang dapat dihapus',
      'INVALID_TRANSACTION_STATE'
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.transactionItem.deleteMany({ where: { transactionId: id } });
    await tx.transactionPayment.deleteMany({ where: { transactionId: id } });
    await tx.transaction.delete({ where: { id } });
  });

  return { id, deleted: true };
}

/**
 * POST /transactions/:id/pay
 * Bayar transaksi DRAFT -> PAID
 * - Cek closing period locked
 * - Validasi sum(payments) >= total (D-3)
 * - Cek stok produk (productId != null) di StockLevel
 * - Kurangi StockLevel & buat InventoryMovement (TRANSACTION)
 * - Update NumberSequence -> generate TRX-YYYYMMDD-XXXXX
 * - Set status PAID, paidAt, cashierId
 * - Audit log & return data lengkap + change
 */
export async function payTransaction(
  id: string,
  input: {
    payments: Array<{
      method: 'CASH' | 'DEBIT' | 'QRIS_TRANSFER';
      amount: string;
    }>;
  },
  cashierId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk transaksi cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Transaksi ini sudah tidak berstatus DRAFT',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const { workDate, dateStr } = getJakartaDateTime();

  // D-4: Cek apakah hari operasional sudah ditutup oleh cash closing
  const closedPeriod = await prisma.cashClosing.findFirst({
    where: {
      branchId: existing.branchId,
      status: 'CLOSED',
      closingDate: { gte: workDate },
    },
  });

  if (closedPeriod) {
    throw new ClosingPeriodLockedError(
      'Periode kas hari ini sudah ditutup, tidak dapat menerima pembayaran'
    );
  }

  // D-3: Validasi jumlah pembayaran
  let paidTotal = new Prisma.Decimal(0);
  for (const p of input.payments) {
    const amt = new Prisma.Decimal(p.amount);
    paidTotal = paidTotal.add(amt);
  }

  if (paidTotal.lessThan(existing.total)) {
    throw new ValidationError(
      `Jumlah pembayaran (${paidTotal}) kurang dari total tagihan (${existing.total})`
    );
  }

  const change = paidTotal.sub(existing.total);

  // Eksekusi atomik dalam $transaction
  const paidTransaction = await prisma.$transaction(async (tx) => {
    // 1. Cek & kurangi stok produk (HANYA item dengan productId != null)
    const productItems = existing.items.filter((item) => item.productId !== null);

    for (const item of productItems) {
      const stock = await tx.stockLevel.findUnique({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: 'PRODUCT',
            itemId: item.productId!,
          },
        },
      });

      const currentQty = stock?.quantity ?? 0;
      if (currentQty < item.quantity) {
        throw new InsufficientStockError(
          `Stok untuk produk "${item.name}" tidak mencukupi (tersedia: ${currentQty}, diminta: ${item.quantity})`
        );
      }

      // Kurangi stok di StockLevel
      await tx.stockLevel.update({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: 'PRODUCT',
            itemId: item.productId!,
          },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      // Catat InventoryMovement
      await tx.inventoryMovement.create({
        data: {
          branchId: existing.branchId,
          itemType: 'PRODUCT',
          productId: item.productId,
          itemId: item.productId!,
          quantityDelta: -item.quantity,
          referenceType: 'TRANSACTION',
          referenceId: existing.id,
          notes: `Penjualan POS item ${item.name}`,
          createdBy: cashierId,
        },
      });
    }

    // 2. Generate Nomor Transaksi Resmi (TRX-YYYYMMDD-XXXXX)
    const seq = await tx.numberSequence.upsert({
      where: {
        branchId_scope_seqDate: {
          branchId: existing.branchId,
          scope: 'TRANSACTION',
          seqDate: workDate,
        },
      },
      create: {
        branchId: existing.branchId,
        scope: 'TRANSACTION',
        seqDate: workDate,
        lastSeq: 1,
      },
      update: {
        lastSeq: { increment: 1 },
      },
    });

    const dateCompact = dateStr.replace(/-/g, '');
    const seqPadded = String(seq.lastSeq).padStart(5, '0');
    const finalTrxNumber = `TRX-${dateCompact}-${seqPadded}`;

    // 3. Catat Pembayaran
    await tx.transactionPayment.createMany({
      data: input.payments.map((p) => ({
        transactionId: existing.id,
        method: p.method,
        amount: new Prisma.Decimal(p.amount),
      })),
    });

    // 4. Update Transaksi ke status PAID
    const updated = await tx.transaction.update({
      where: { id: existing.id },
      data: {
        transactionNumber: finalTrxNumber,
        status: 'PAID',
        cashierId,
        paidAt: new Date(),
      },
      include: transactionInclude,
    });

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: cashierId,
        action: 'TRANSACTION_PAID',
        entity: 'Transaction',
        entityId: existing.id,
        before: { status: 'DRAFT', transactionNumber: existing.transactionNumber },
        after: {
          status: 'PAID',
          transactionNumber: finalTrxNumber,
          total: updated.total,
          paidTotal,
          change,
        },
        note: `Pembayaran transaksi ${finalTrxNumber} berhasil`,
        ip,
      },
    });

    return updated;
  });

  return {
    ...serializeTransaction(paidTransaction),
    paidTotal: paidTotal.toString(),
    change: change.toString(),
  };
}

/**
 * POST /transactions/:id/cancel [OWNER]
 * Cancel Transaksi PAID
 * - Hanya boleh untuk status PAID
 * - Kembalikan stok (productId != null) di StockLevel & InventoryMovement (+qty)
 * - Update status CANCELLED, cancelledAt, cancelledBy, cancellationReason
 * - Audit log TRANSACTION_CANCELLED
 */
export async function cancelTransaction(
  id: string,
  reason: string,
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  if (existing.status !== 'PAID') {
    throw new ConflictError(
      'Hanya transaksi berstatus PAID yang dapat dibatalkan',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    // 1. Kembalikan stok produk (HANYA item dengan productId != null)
    const productItems = existing.items.filter((item) => item.productId !== null);

    for (const item of productItems) {
      await tx.stockLevel.upsert({
        where: {
          branchId_itemType_itemId: {
            branchId: existing.branchId,
            itemType: 'PRODUCT',
            itemId: item.productId!,
          },
        },
        create: {
          branchId: existing.branchId,
          itemType: 'PRODUCT',
          itemId: item.productId!,
          quantity: item.quantity,
        },
        update: {
          quantity: { increment: item.quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          branchId: existing.branchId,
          itemType: 'PRODUCT',
          productId: item.productId,
          itemId: item.productId!,
          quantityDelta: item.quantity,
          referenceType: 'TRANSACTION',
          referenceId: existing.id,
          notes: `Pembatalan transaksi: ${reason}`,
          createdBy: actorId,
        },
      });
    }

    // 2. Update status transaksi
    const res = await tx.transaction.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: actorId,
        cancellationReason: reason,
      },
      include: transactionInclude,
    });

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'TRANSACTION_CANCELLED',
        entity: 'Transaction',
        entityId: id,
        before: { status: 'PAID' },
        after: {
          status: 'CANCELLED',
          cancelledBy: actorId,
          cancellationReason: reason,
        },
        note: `Pembatalan transaksi ${existing.transactionNumber}: ${reason}`,
        ip,
      },
    });

    return res;
  });

  return serializeTransaction(cancelled);
}
