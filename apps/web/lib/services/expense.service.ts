import { prisma } from '../prisma';
import { Prisma, type ExpenseCategory, type UserRole } from '@prisma/client';
import { ValidationError, NotFoundError } from '../errors';
import { getJakartaDateTime } from './attendance.service';
import type { CreateExpenseInput, ExpenseListQuery } from '../validations/expense.schema';

/**
 * Format tanggal YYYY-MM-DD dari Date object UTC
 */
function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SerializedExpense {
  id: string;
  branchId: string;
  branch?: {
    id: string;
    code: string;
    name: string;
  } | null;
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  note: string;
  proofUrl: string | null;
  createdBy: string;
  createdByUser?: {
    id: string;
    email: string;
    employee: {
      name: string;
    } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeExpense(expense: {
  id: string;
  branchId: string;
  branch?: { id: string; code: string; name: string } | null;
  category: ExpenseCategory;
  amount: Prisma.Decimal;
  expenseDate: Date;
  note: string;
  proofUrl: string | null;
  createdBy: string;
  createdByUser?: {
    id: string;
    email: string;
    employee: { name: string } | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedExpense {
  return {
    id: expense.id,
    branchId: expense.branchId,
    branch: expense.branch ?? null,
    category: expense.category,
    amount: expense.amount.toString(),
    expenseDate: formatDateOnly(expense.expenseDate),
    note: expense.note,
    proofUrl: expense.proofUrl,
    createdBy: expense.createdBy,
    createdByUser: expense.createdByUser ?? null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

/**
 * Helper: Ambil info user (email & nama karyawan) untuk pembuat pengeluaran
 */
async function enrichExpenses<T extends { createdBy: string }>(expenses: T[]) {
  const userIds = Array.from(new Set(expenses.map((e) => e.createdBy)));
  if (userIds.length === 0) return expenses;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      email: true,
      employee: { select: { name: true } },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return expenses.map((e) => ({
    ...e,
    createdByUser: userMap.get(e.createdBy) ?? null,
  }));
}

/**
 * POST /api/v1/expenses
 * Mencatat pengeluaran baru. Status langsung RECORDED (immutable).
 */
export async function createExpense(
  input: CreateExpenseInput,
  actor: {
    userId: string;
    role: UserRole;
    activeBranchId: string | null;
  },
  ip?: string | null
): Promise<SerializedExpense> {
  // 1. Tentukan target branchId
  let targetBranchId: string;
  if (actor.role === 'OWNER') {
    targetBranchId = input.branchId || actor.activeBranchId || '';
    if (!targetBranchId) {
      throw new ValidationError('Branch ID wajib ditentukan untuk pencatatan pengeluaran');
    }
  } else {
    if (!actor.activeBranchId) {
      throw new ValidationError('Cabang aktif diperlukan untuk mencatat pengeluaran');
    }
    targetBranchId = actor.activeBranchId;
  }

  // Verifikasi cabang aktif
  const branch = await prisma.branch.findUnique({
    where: { id: targetBranchId },
    select: { id: true, code: true, name: true, active: true },
  });
  if (!branch || !branch.active) {
    throw new NotFoundError('Cabang tidak ditemukan atau sudah tidak aktif');
  }

  // 2. Validasi jumlah pengeluaran (> 0)
  const amountDecimal = new Prisma.Decimal(input.amount);
  if (amountDecimal.lte(0)) {
    throw new ValidationError('Jumlah pengeluaran harus lebih besar dari 0');
  }

  // 3. Validasi tanggal pengeluaran (<= hari ini waktu WIB)
  const { dateStr: todayJakarta } = getJakartaDateTime();
  if (input.expenseDate > todayJakarta) {
    throw new ValidationError('Tanggal pengeluaran tidak boleh melebihi hari ini');
  }

  const expenseDateUtc = new Date(`${input.expenseDate}T00:00:00.000Z`);

  // 4. Catat pengeluaran & buat audit log dalam satu transaksi
  const created = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        branchId: targetBranchId,
        category: input.category,
        amount: amountDecimal,
        expenseDate: expenseDateUtc,
        note: input.note.trim(),
        proofUrl: input.proofUrl ?? null,
        createdBy: actor.userId,
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    const serialized = serializeExpense(expense);

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'CREATE',
        entity: 'Expense',
        entityId: expense.id,
        after: serialized as unknown as Prisma.InputJsonValue,
        ip: ip ?? null,
      },
    });

    return serialized;
  });

  return created;
}

/**
 * GET /api/v1/expenses
 * Ambil daftar pengeluaran dengan filter & paginasi.
 */
export async function listExpenses(
  query: ExpenseListQuery,
  actor: {
    userId: string;
    role: UserRole;
    activeBranchId: string | null;
  }
) {
  const where: Prisma.ExpenseWhereInput = {};

  // Scope branch
  if (actor.role === 'OWNER') {
    if (query.branchId) {
      where.branchId = query.branchId;
    }
  } else {
    if (!actor.activeBranchId) {
      throw new ValidationError('Cabang aktif diperlukan');
    }
    where.branchId = actor.activeBranchId;
  }

  // Filter kategori
  if (query.category) {
    where.category = query.category;
  }

  // Filter rentang tanggal
  if (query.dateFrom || query.dateTo) {
    where.expenseDate = {};
    if (query.dateFrom) {
      where.expenseDate.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      where.expenseDate.lte = new Date(`${query.dateTo}T00:00:00.000Z`);
    }
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const [total, rawExpenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
      },
    }),
  ]);

  const enriched = await enrichExpenses(rawExpenses);
  const data = enriched.map(serializeExpense);

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
