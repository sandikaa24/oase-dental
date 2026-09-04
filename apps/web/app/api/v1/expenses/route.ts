import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createExpenseSchema,
  expenseListQuerySchema,
} from '@/lib/validations/expense.schema';
import {
  createExpense,
  listExpenses,
} from '@/lib/services/expense.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/expenses
 * List pengeluaran untuk branch aktif (MANAGER) atau semua/filter branch (OWNER).
 * Permission: EXPENSE_REPORT atau EXPENSE_CREATE
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  // OWNER atau MANAGER berhak melihat riwayat pengeluaran
  requirePermission(auth, 'EXPENSE_REPORT');

  const { searchParams } = new URL(req.url);
  const input = expenseListQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const { data, ...meta } = await listExpenses(input, {
    userId: auth.userId,
    role: auth.role,
    activeBranchId: auth.branchId,
  });

  return ok(data, meta);
});

/**
 * POST /api/v1/expenses
 * Mencatat pengeluaran operasional baru (RECORDED & immutable).
 * Permission: EXPENSE_CREATE (OWNER, MANAGER)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'EXPENSE_CREATE');

  const body = await req.json();
  const input = createExpenseSchema.parse(body);

  const data = await createExpense(
    input,
    {
      userId: auth.userId,
      role: auth.role,
      activeBranchId: auth.branchId,
    },
    getClientIp(req)
  );

  const res = ok(data);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
