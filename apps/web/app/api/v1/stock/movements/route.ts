import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { stockMovementsQuerySchema } from '@/lib/validations/stock.schema';
import { getStockMovements, type UserContext } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/stock/movements
 * Riwayat mutasi per produk / cabang
 * Role: [OWNER, MANAGER, CASHIER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER', 'CASHIER');

  const { searchParams } = new URL(req.url);
  const query = stockMovementsQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const userContext: UserContext = {
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    activeBranchId: auth.branchId,
    employeeId: auth.employeeId,
  };

  const { movements, meta } = await getStockMovements(query, userContext);
  return ok(movements, meta);
});
