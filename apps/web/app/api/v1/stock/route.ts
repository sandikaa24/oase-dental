import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { stockListQuerySchema } from '@/lib/validations/stock.schema';
import { getStockList, type UserContext } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/stock
 * Daftar stok per cabang dengan indikator kadaluarsa & stok rendah
 * Role: [OWNER, MANAGER, CASHIER] (CASHIER read-only)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER', 'CASHIER');

  const { searchParams } = new URL(req.url);
  const query = stockListQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const userContext: UserContext = {
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    activeBranchId: auth.branchId,
    employeeId: auth.employeeId,
  };

  const { stocks, branchId, meta } = await getStockList(query, userContext);
  return ok({ branchId, items: stocks }, meta);
});
