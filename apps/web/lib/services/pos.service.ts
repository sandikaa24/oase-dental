import { prisma } from '../prisma';
import { Prisma, type UserRole, type TransactionStatus } from '@prisma/client';
import {
  ClosingPeriodLockedError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../errors';
import { getJakartaDateTime } from './attendance.service';

/**
 * Format output transaksi yang aman untuk JSON (semua Decimal diserialisasi ke string,
 * dan itemType dikembalikan sebagai SERVICE).
 */
export function serializeTransaction<
  T extends {
    subtotal: Prisma.Decimal;
    total: Prisma.Decimal;
    items?: Array<{
      id: string;
      serviceId: string;
      itemId: string;
      name: string;
      nameEn: string | null;
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
    total: trx.total.toString(),
    items: trx.items?.map((item) => ({
      ...item,
      itemType: 'SERVICE',
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
 * Create DRAFT Transaksi (Murni Layanan Medis, Tanpa Diskon, Tanpa Sentuh Stok)
 * - Snapshot harga dan nama dari master database
 * - Hitung subtotal = sum(price * qty) dan total = subtotal
 */
export async function createTransaction(
  input: {
    items: Array<{
      itemId: string;
      quantity: number;
      itemType?: 'SERVICE';
    }>;
    patientName?: string | null;
    patientPhone?: string | null;
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

  // Siapkan dan snapshot setiap layanan dari database
  let subtotal = new Prisma.Decimal(0);
  const resolvedItems: Array<{
    serviceId: string;
    itemId: string;
    name: string;
    nameEn: string | null;
    price: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }> = [];

  for (const item of input.items) {
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
      serviceId: service.id,
      itemId: service.id,
      name: service.name,
      nameEn: service.nameEn,
      price: service.price,
      quantity: item.quantity,
      lineTotal,
    });
  }

  // Transaksi tanpa diskon: total = subtotal
  const total = subtotal;

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
 * Edit DRAFT transaksi saja (Murni Layanan Medis, Tanpa Diskon)
 */
export async function updateTransaction(
  id: string,
  input: {
    items?: Array<{
      itemId: string;
      quantity: number;
      itemType?: 'SERVICE';
    }>;
    patientName?: string | null;
    patientPhone?: string | null;
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
    serviceId: string;
    itemId: string;
    name: string;
    nameEn: string | null;
    price: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }> | null = null;

  if (input.items !== undefined) {
    subtotal = new Prisma.Decimal(0);
    resolvedItems = [];

    for (const item of input.items) {
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
        serviceId: service.id,
        itemId: service.id,
        name: service.name,
        nameEn: service.nameEn,
        price: service.price,
        quantity: item.quantity,
        lineTotal,
      });
    }
  }

  const total = subtotal;

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
  const existing = await prisma.transaction.findUnique({ where: { id } });
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
  await prisma.transaction.delete({ where: { id } });
  return { id };
}

/**
 * Helper: Cek apakah tanggal transaksi berada dalam periode tutup kas yang berstatus CLOSED.
 */
async function assertClosingNotLocked(branchId: string, transactionDate: Date) {
  const lockedClosing = await prisma.cashClosing.findFirst({
    where: {
      branchId,
      status: 'CLOSED',
      closingDate: { gte: transactionDate },
    },
  });

  if (lockedClosing) {
    throw new ClosingPeriodLockedError(
      'Transaksi tidak dapat diproses: periode tutup kas untuk tanggal ini sudah ditutup (CLOSED)'
    );
  }
}

/**
 * POST /transactions/:id/pay
 * Bayar transaksi DRAFT → PAID
 * - Hanya transaksi berstatus DRAFT yang bisa dibayar
 * - Validasi closing kas CLOSED
 * - Validasi total pembayaran >= total tagihan
 * - Generate nomor transaksi resmi TRX-YYYYMMDD-XXXXX
 * - Simpan payments
 * - TIDAK MENYENTUH STOK (Transaksi murni layanan)
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
    include: {
      items: true,
      branch: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  // IDOR Guard
  if (role !== 'OWNER' && existing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk transaksi cabang lain');
  }

  if (existing.status !== 'DRAFT') {
    throw new ConflictError(
      'Hanya transaksi berstatus DRAFT yang dapat dibayar',
      'INVALID_TRANSACTION_STATE'
    );
  }

  if (existing.items.length === 0) {
    throw new ValidationError('Transaksi tidak memiliki item');
  }

  // D-2: Server Date Asia/Jakarta
  const { dateStr } = getJakartaDateTime();
  const workDate = new Date(`${dateStr}T00:00:00.000Z`);

  // Cek closing period lock
  await assertClosingNotLocked(existing.branchId, existing.transactionDate);

  // Validasi total pembayaran >= existing.total
  let paidTotal = new Prisma.Decimal(0);
  for (const p of input.payments) {
    const amt = new Prisma.Decimal(p.amount);
    if (amt.lessThanOrEqualTo(0)) {
      throw new ValidationError('Jumlah pembayaran setiap metode harus lebih besar dari 0');
    }
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
    // 1. Generate Nomor Transaksi Resmi (TRX-YYYYMMDD-XXXXX)
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
    const seqPadded = seq.lastSeq.toString().padStart(5, '0');
    const officialTrxNumber = `TRX-${dateCompact}-${seqPadded}`;

    // 2. Simpan Catatan Pembayaran
    await tx.transactionPayment.createMany({
      data: input.payments.map((p) => ({
        transactionId: existing.id,
        method: p.method,
        amount: new Prisma.Decimal(p.amount),
      })),
    });

    // 3. Update Status Transaksi menjadi PAID
    const updated = await tx.transaction.update({
      where: { id: existing.id },
      data: {
        transactionNumber: officialTrxNumber,
        status: 'PAID',
        paidAt: new Date(),
        cashierId,
      },
      include: transactionInclude,
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: cashierId,
        action: 'TRANSACTION_PAID',
        entity: 'Transaction',
        entityId: existing.id,
        ip,
        after: {
          transactionNumber: officialTrxNumber,
          total: existing.total.toString(),
          paidTotal: paidTotal.toString(),
          change: change.toString(),
          payments: input.payments,
        },
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
 * POST /transactions/:id/cancel
 * Membatalkan transaksi PAID → CANCELLED
 * - Hanya transaksi berstatus PAID yang bisa dibatalkan
 * - Validasi closing kas CLOSED
 * - TIDAK MENYENTUH STOK (Transaksi murni layanan)
 */
export async function cancelTransaction(
  id: string,
  reason: string,
  actorId: string,
  ip: string | null
) {
  const existing = await prisma.transaction.findUnique({
    where: { id },
    include: {
      items: true,
      branch: true,
      payments: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Transaksi tidak ditemukan');
  }

  // Cek closing period lock
  await assertClosingNotLocked(existing.branchId, existing.transactionDate);

  if (existing.status !== 'PAID') {
    throw new ConflictError(
      'Hanya transaksi berstatus PAID yang dapat dibatalkan',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    // 1. Update status transaksi
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

    // 2. Audit Log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'TRANSACTION_CANCELLED',
        entity: 'Transaction',
        entityId: id,
        ip,
        before: {
          status: existing.status,
          transactionNumber: existing.transactionNumber,
          total: existing.total.toString(),
        },
        after: {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledBy: actorId,
        },
      },
    });

    return res;
  });

  return serializeTransaction(cancelled);
}

/**
 * GET /pos/catalog
 * Katalog item yang bisa dijual/ditransaksikan di POS:
 * Murni master layanan medis aktif (tidak menyentuh produk & stok)
 */
export async function getPosCatalog(
  _branchId: string | null,
  query?: {
    type?: string;
    categoryId?: string;
    search?: string;
  }
) {
  const search = query?.search?.trim();
  const results: Array<{
    id: string;
    name: string;
    type: 'SERVICE';
    price: string;
    stock: null;
    unit: null;
    category: { id: string; name: string } | null;
  }> = [];

  // Ambil Layanan Aktif
  const serviceWhere: Prisma.ServiceWhereInput = {
    active: true,
    deletedAt: null,
  };

  if (query?.categoryId) {
    serviceWhere.categoryId = query.categoryId;
  }

  if (search) {
    serviceWhere.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
    ];
  }

  const services = await prisma.service.findMany({
    where: serviceWhere,
    include: { category: true },
    orderBy: { name: 'asc' },
  });

  for (const s of services) {
    results.push({
      id: s.id,
      name: s.name,
      type: 'SERVICE',
      price: s.price.toString(),
      stock: null,
      unit: null,
      category: s.category ? { id: s.category.id, name: s.category.name } : null,
    });
  }

  return results;
}
