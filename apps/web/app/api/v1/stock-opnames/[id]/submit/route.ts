import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { submitStockOpname } from '@/lib/services/inventory.service';

/**
 * POST /api/v1/stock-opnames/:id/submit
 * Finalisasi DRAFT -> SUBMITTED (Atomik mutasi StockLevel & movement OPNAME)
 * Permission: STOCK_OPNAME_MANAGE [OWNER, MANAGER]
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'STOCK_OPNAME_MANAGE');

    const ip = getClientIp(req);

    const result = await submitStockOpname(
      params.id,
      auth.userId,
      auth.role,
      auth.branchId,
      ip
    );

    return ok(result);
  }
);
