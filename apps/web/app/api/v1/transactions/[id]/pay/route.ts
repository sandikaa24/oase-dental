import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { payTransactionSchema } from '@/lib/validations/pos.schema';
import { payTransaction } from '@/lib/services/pos.service';

/**
 * POST /api/v1/transactions/:id/pay
 * Bayar transaksi DRAFT -> PAID
 * Permission: POS_CREATE (OWNER, CASHIER)
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'POS_CREATE');

    const body = await req.json();
    const input = payTransactionSchema.parse(body);
    const ip = getClientIp(req);

    const result = await payTransaction(
      params.id,
      input,
      auth.userId,
      auth.role,
      auth.branchId,
      ip
    );

    const res = ok(result);
    return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
  }
);
