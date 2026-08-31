import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { stockInSchema } from '@/lib/validations/inventory.schema';
import { stockIn } from '@/lib/services/inventory.service';

/**
 * POST /api/v1/inventory/stock-in
 * Barang masuk multi-item (atomik)
 * Permission: STOCK_IN [OWNER, MANAGER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'STOCK_IN');

  const body = await req.json();
  const input = stockInSchema.parse(body);
  const ip = getClientIp(req);

  const result = await stockIn(
    input,
    auth.userId,
    auth.role,
    auth.branchId,
    ip
  );

  const res = ok(result);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
