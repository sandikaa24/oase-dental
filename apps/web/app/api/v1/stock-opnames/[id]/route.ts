import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateStockOpnameSchema } from '@/lib/validations/inventory.schema';
import {
  getStockOpnameById,
  updateStockOpname,
} from '@/lib/services/inventory.service';

/**
 * GET /api/v1/stock-opnames/:id
 * Detail stock opname + items
 * Permission: STOCK_OPNAME_MANAGE [OWNER, MANAGER]
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'STOCK_OPNAME_MANAGE');

    const result = await getStockOpnameById(
      params.id,
      auth.role,
      auth.branchId
    );

    return ok(result);
  }
);

/**
 * PATCH /api/v1/stock-opnames/:id
 * Edit DRAFT stock opname (REPLACE physicalQty & note)
 * Permission: STOCK_OPNAME_MANAGE [OWNER, MANAGER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'STOCK_OPNAME_MANAGE');

    const body = await req.json();
    const input = updateStockOpnameSchema.parse(body);

    const result = await updateStockOpname(
      params.id,
      input,
      auth.role,
      auth.branchId
    );

    return ok(result);
  }
);
