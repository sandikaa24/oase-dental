import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { stockOutSchema } from '@/lib/validations/inventory.schema';
import { stockOut } from '@/lib/services/inventory.service';

/**
 * POST /api/v1/inventory/stock-out
 * Pengeluaran barang manual multi-item (atomik)
 * Permission: STOCK_IN [OWNER, MANAGER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'STOCK_IN');

  const body = await req.json();
  const input = stockOutSchema.parse(body);
  const ip = getClientIp(req);

  const result = await stockOut(
    input,
    auth.userId,
    auth.role,
    auth.branchId,
    ip
  );

  const res = ok(result);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
