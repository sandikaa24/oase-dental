import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { movementListQuerySchema } from '@/lib/validations/inventory.schema';
import { getStockMovements } from '@/lib/services/inventory.service';
import { ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/inventory/stock/:itemType/:itemId/movements
 * Kartu stok riwayat movement
 * Role: [OWNER, MANAGER]
 */
export const GET = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: { itemType: string; itemId: string } }
  ) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER', 'MANAGER');

    const itemType = params.itemType.toUpperCase();
    if (itemType !== 'PRODUCT' && itemType !== 'MATERIAL') {
      throw new ValidationError('itemType harus bernilai PRODUCT atau MATERIAL');
    }

    const { searchParams } = new URL(req.url);
    const input = movementListQuerySchema.parse(
      Object.fromEntries(searchParams.entries())
    );

    const { item, data, meta } = await getStockMovements(
      itemType,
      params.itemId,
      input,
      auth.role,
      auth.branchId
    );

    return ok({ item, movements: data }, meta);
  }
);
