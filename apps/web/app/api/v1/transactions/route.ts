import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createTransactionSchema,
  transactionListQuerySchema,
} from '@/lib/validations/pos.schema';
import {
  createTransaction,
  listTransactions,
} from '@/lib/services/pos.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/transactions
 * List transaksi branch aktif (CASHIER) atau semua/filter branch (OWNER).
 * Role: [OWNER, CASHIER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'CASHIER');

  const { searchParams } = new URL(req.url);
  const input = transactionListQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const { data, ...meta } = await listTransactions(
    {
      page: input.page,
      limit: input.limit,
      status: input.status,
      date: input.date,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      cashierId: input.cashierId,
      branchId: input.branchId,
      search: input.search,
    },
    auth.role,
    auth.branchId
  );

  return ok(data, meta);
});

/**
 * POST /api/v1/transactions
 * Create DRAFT Transaksi
 * Permission: POS_CREATE (OWNER, CASHIER)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'POS_CREATE');

  const body = await req.json();
  const input = createTransactionSchema.parse(body);

  const transaction = await createTransaction(
    input,
    auth.branchId,
    auth.userId
  );

  const res = ok(transaction);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
