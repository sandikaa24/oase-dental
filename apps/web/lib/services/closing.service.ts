import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import type { UserRole } from '@oase/shared';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { getJakartaDateTime } from './attendance.service';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CashClosingStatus = 'OPEN' | 'CLOSED';

/**
 * Serialisasi CashClosing: semua Decimal → string agar aman di JSON response.
 */
export function serializeClosing(closing: {
  id: string;
  branchId: string;
  branch?: { id: string; code: string; name: string } | null;
  status: CashClosingStatus;
  periodStart: Date;
  closingDate: Date;
  expectedCash: Prisma.Decimal;
  actualCash: Prisma.Decimal;
  variance: Prisma.Decimal;
  note: string | null;
  closedBy: string;
  closedByUser?: { id: string; email: string; employee: { name: string } | null } | null;
  reopenedBy: string | null;
  reopenedByUser?: { id: string; email: string; employee: { name: string } | null } | null;
  reopenedReason: string | null;
  reopenedAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...closing,
    expectedCash: closing.expectedCash.toString(),
    actualCash: closing.actualCash.toString(),
    variance: closing.variance.toString(),
    periodStart: closing.periodStart.toISOString(),
    closingDate: closing.closingDate.toISOString(),
    reopenedAt: closing.reopenedAt?.toISOString() ?? null,
    createdAt: closing.createdAt.toISOString(),
  };
}

const closingInclude = {
  branch: {
    select: { id: true, code: true, name: true },
  },
} as const;

/**
 * Helper: Ambil info user (email & employee name) untuk closedBy dan reopenedBy.
 */
async function enrichClosings<T extends { closedBy: string; reopenedBy: string | null }>(closings: T[]) {
  const userIds = Array.from(
    new Set(
      closings.flatMap((c) => [c.closedBy, c.reopenedBy]).filter((id): id is string => Boolean(id))
    )
  );

  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          employee: { select: { name: true } },
        },
      })
    : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return closings.map((c) => ({
    ...c,
    closedByUser: userMap.get(c.closedBy) ?? null,
    reopenedByUser: c.reopenedBy ? (userMap.get(c.reopenedBy) ?? null) : null,
  }));
}

async function enrichClosing<T extends { closedBy: string; reopenedBy: string | null }>(closing: T) {
  const [enriched] = await enrichClosings([closing]);
  return enriched!;
}

/**
 * Helper: Tentukan awal periode closing (periodStart).
 * - Jika sudah ada closing CLOSED sebelumnya: periodStart = closingDate terakhir.
 * - Jika belum pernah closing: periodStart = paidAt transaksi PAID pertama di cabang, atau awal hari kerja (workDate).
 */
async function resolvePeriodStart(branchId: string) {
  const lastClosed = await prisma.cashClosing.findFirst({
    where: { branchId, status: 'CLOSED' },
    orderBy: { closingDate: 'desc' },
  });

  if (lastClosed) {
    return {
      periodStart: lastClosed.closingDate,
      isFirstClosing: false,
      lastClosed,
    };
  }

  const firstTx = await prisma.transaction.findFirst({
    where: { branchId, status: 'PAID', paidAt: { not: null } },
    orderBy: { paidAt: 'asc' },
    select: { paidAt: true },
  });

  const { workDate } = getJakartaDateTime();
  const periodStart = firstTx?.paidAt ?? workDate;

  return {
    periodStart,
    isFirstClosing: true,
    lastClosed: null,
  };
}

// ─── A: Preview ─────────────────────────────────────────────────────────────

/**
 * GET /cash-closings/preview
 * Hitung expectedCash real-time dari transaksi CASH PAID sejak closing terakhir.
 * Tidak ada perubahan di database.
 */
export async function getClosingPreview(branchId: string | null) {
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk preview closing');
  }

  const { periodStart, isFirstClosing, lastClosed } = await resolvePeriodStart(branchId);
  const paidAtFilter = isFirstClosing ? { gte: periodStart } : { gt: periodStart };

  // Cek apakah hari ini sudah ada closing CLOSED (untuk menentukan apakah kasir masih bisa submit)
  const { workDate } = getJakartaDateTime();
  const todayClosed = await prisma.cashClosing.findFirst({
    where: {
      branchId,
      status: 'CLOSED',
      closingDate: { gte: workDate },
    },
  });

  // Jumlahkan semua pembayaran CASH dari transaksi PAID dalam periode ini
  const cashPayments = await prisma.transactionPayment.aggregate({
    where: {
      method: 'CASH',
      transaction: {
        branchId,
        status: 'PAID',
        paidAt: paidAtFilter,
      },
    },
    _sum: { amount: true },
  });

  const expectedCash = cashPayments._sum.amount ?? new Prisma.Decimal(0);

  // Hitung jumlah transaksi PAID dalam periode ini (semua metode)
  const transactionCount = await prisma.transaction.count({
    where: {
      branchId,
      status: 'PAID',
      paidAt: paidAtFilter,
    },
  });

  // Total omset semua metode (untuk informasi kasir)
  const totalRevenue = await prisma.transactionPayment.aggregate({
    where: {
      transaction: {
        branchId,
        status: 'PAID',
        paidAt: paidAtFilter,
      },
    },
    _sum: { amount: true },
  });

  return {
    branchId,
    periodStart: periodStart.toISOString(),
    expectedCash: expectedCash.toString(),
    transactionCount,
    totalRevenue: (totalRevenue._sum.amount ?? new Prisma.Decimal(0)).toString(),
    alreadyClosedToday: !!todayClosed,
    lastClosingDate: lastClosed ? lastClosed.closingDate.toISOString() : null,
  };
}

// ─── B: Create Closing ───────────────────────────────────────────────────────

/**
 * POST /cash-closings
 * Kasir submit closing kas: actualCash + note.
 * Status langsung CLOSED. Periode transaksi terkunci.
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER).
 */
export async function createClosing(
  input: { actualCash: string; note?: string | null },
  closedByUserId: string,
  branchId: string | null,
  ip: string | null
) {
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk membuat closing');
  }

  const { workDate } = getJakartaDateTime();
  const actualCash = new Prisma.Decimal(input.actualCash);

  // Guard: tolak jika sudah ada closing CLOSED hari ini
  const existingClosed = await prisma.cashClosing.findFirst({
    where: {
      branchId,
      status: 'CLOSED',
      closingDate: { gte: workDate },
    },
  });

  if (existingClosed) {
    throw new ConflictError(
      'Sudah ada closing kas yang aktif di hari ini. Tidak bisa membuat closing ganda.',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const { periodStart, isFirstClosing } = await resolvePeriodStart(branchId);
  const paidAtFilter = isFirstClosing ? { gte: periodStart } : { gt: periodStart };

  // Hitung expectedCash dari server (total CASH PAID sejak closing terakhir)
  const cashPayments = await prisma.transactionPayment.aggregate({
    where: {
      method: 'CASH',
      transaction: {
        branchId,
        status: 'PAID',
        paidAt: paidAtFilter,
      },
    },
    _sum: { amount: true },
  });

  const expectedCash = cashPayments._sum.amount ?? new Prisma.Decimal(0);
  const variance = actualCash.sub(expectedCash);

  // Atomik: buat CashClosing + audit log
  const closing = await prisma.$transaction(async (tx) => {
    const newClosing = await tx.cashClosing.create({
      data: {
        branchId,
        status: 'CLOSED',
        periodStart,
        closingDate: new Date(),
        expectedCash,
        actualCash,
        variance,
        note: input.note ?? null,
        closedBy: closedByUserId,
      },
      include: closingInclude,
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: closedByUserId,
        action: 'CASH_CLOSING_CLOSED',
        entity: 'CashClosing',
        entityId: newClosing.id,
        after: {
          status: 'CLOSED',
          expectedCash: expectedCash.toString(),
          actualCash: actualCash.toString(),
          variance: variance.toString(),
        },
        note: `Tutup kas cabang: expectedCash=${expectedCash}, actualCash=${actualCash}, variance=${variance}`,
        ip,
      },
    });

    return newClosing;
  });

  const enriched = await enrichClosing(closing);
  return serializeClosing(enriched);
}

// ─── C: List Closings ────────────────────────────────────────────────────────

/**
 * GET /cash-closings
 * List closing dengan pagination. OWNER bisa filter ?branchId.
 * Non-OWNER terkunci pada branchId aktif dari JWT.
 */
export async function listClosings(
  params: {
    page: number;
    limit: number;
    status?: CashClosingStatus;
    branchId?: string;
  },
  role: UserRole,
  activeBranchId: string | null
) {
  const where: Prisma.CashClosingWhereInput = {};

  // Scope guard: non-OWNER terkunci pada branchId aktif
  if (role !== 'OWNER') {
    if (!activeBranchId) {
      throw new ValidationError('Branch aktif diperlukan');
    }
    where.branchId = activeBranchId;
  } else if (params.branchId) {
    where.branchId = params.branchId;
  }

  if (params.status) {
    where.status = params.status;
  }

  const skip = (params.page - 1) * params.limit;

  const [data, total] = await Promise.all([
    prisma.cashClosing.findMany({
      where,
      include: closingInclude,
      orderBy: { closingDate: 'desc' },
      skip,
      take: params.limit,
    }),
    prisma.cashClosing.count({ where }),
  ]);

  const enriched = await enrichClosings(data);

  return {
    data: enriched.map(serializeClosing),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

// ─── D: Get Closing by ID ────────────────────────────────────────────────────

/**
 * GET /cash-closings/:id
 * Detail closing + IDOR guard (non-OWNER hanya bisa lihat cabang aktifnya).
 */
export async function getClosingById(
  id: string,
  role: UserRole,
  activeBranchId: string | null
) {
  const closing = await prisma.cashClosing.findUnique({
    where: { id },
    include: closingInclude,
  });

  if (!closing) {
    throw new NotFoundError('Data closing tidak ditemukan');
  }

  // IDOR guard
  if (role !== 'OWNER' && closing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk closing cabang lain');
  }

  const enriched = await enrichClosing(closing);
  return serializeClosing(enriched);
}

// ─── E: Reopen Closing ───────────────────────────────────────────────────────

/**
 * POST /cash-closings/:id/reopen
 * Buka kembali closing yang CLOSED. Hanya OWNER.
 * Status kembali OPEN, audit log dibuat.
 * Catatan: setelah reopen, status = OPEN kembali; closing baru bisa dibuat.
 */
export async function reopenClosing(
  id: string,
  reason: string,
  reopenedByUserId: string,
  role: UserRole,
  activeBranchId: string | null,
  ip: string | null
) {
  const closing = await prisma.cashClosing.findUnique({
    where: { id },
    include: closingInclude,
  });

  if (!closing) {
    throw new NotFoundError('Data closing tidak ditemukan');
  }

  // IDOR guard: OWNER bisa akses semua (activeBranchId null), non-OWNER harus cocok
  if (role !== 'OWNER' && closing.branchId !== activeBranchId) {
    throw new ForbiddenError('Akses ditolak untuk closing cabang lain');
  }

  if (closing.status !== 'CLOSED') {
    throw new ConflictError(
      'Hanya closing berstatus CLOSED yang bisa dibuka kembali',
      'INVALID_TRANSACTION_STATE'
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.cashClosing.update({
      where: { id },
      data: {
        status: 'OPEN',
        reopenedBy: reopenedByUserId,
        reopenedReason: reason,
        reopenedAt: new Date(),
      },
      include: closingInclude,
    });

    await tx.auditLog.create({
      data: {
        actorId: reopenedByUserId,
        action: 'CASH_CLOSING_REOPENED',
        entity: 'CashClosing',
        entityId: id,
        before: { status: 'CLOSED' },
        after: { status: 'OPEN', reopenedReason: reason },
        note: `Buka kembali closing: ${reason}`,
        ip,
      },
    });

    return res;
  });

  const enriched = await enrichClosing(updated);
  return serializeClosing(enriched);
}

// ─── F: Dashboard Cashier ────────────────────────────────────────────────────

/**
 * GET /dashboard/cashier
 * Ringkasan hari ini untuk kasir:
 * - Transaksi hari ini (count + total + breakdown metode)
 * - Status closing hari ini
 */
export async function getCashierDashboard(branchId: string | null) {
  if (!branchId) {
    throw new ValidationError('Branch aktif diperlukan untuk dashboard');
  }

  const { workDate } = getJakartaDateTime();

  // Rentang hari ini (UTC): dari workDate (00:00 UTC) sampai besok
  const tomorrowDate = new Date(workDate);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);

  // Transaksi PAID hari ini
  const todayTransactions = await prisma.transaction.findMany({
    where: {
      branchId,
      status: 'PAID',
      paidAt: { gte: workDate, lt: tomorrowDate },
    },
    include: { payments: true },
  });

  const transactionCount = todayTransactions.length;
  let totalRevenue = new Prisma.Decimal(0);
  let cashRevenue = new Prisma.Decimal(0);
  let debitRevenue = new Prisma.Decimal(0);
  let qrisRevenue = new Prisma.Decimal(0);

  for (const trx of todayTransactions) {
    totalRevenue = totalRevenue.add(trx.total);
    for (const p of trx.payments) {
      if (p.method === 'CASH') cashRevenue = cashRevenue.add(p.amount);
      else if (p.method === 'DEBIT') debitRevenue = debitRevenue.add(p.amount);
      else if (p.method === 'QRIS_TRANSFER') qrisRevenue = qrisRevenue.add(p.amount);
    }
  }

  // Status closing hari ini
  const todayClosing = await prisma.cashClosing.findFirst({
    where: {
      branchId,
      closingDate: { gte: workDate },
    },
    orderBy: { closingDate: 'desc' },
  });

  return {
    date: workDate.toISOString().split('T')[0],
    branchId,
    transactionCount,
    totalRevenue: totalRevenue.toString(),
    cashRevenue: cashRevenue.toString(),
    debitRevenue: debitRevenue.toString(),
    qrisRevenue: qrisRevenue.toString(),
    closingStatus: todayClosing?.status ?? null,
    closingId: todayClosing?.id ?? null,
  };
}
