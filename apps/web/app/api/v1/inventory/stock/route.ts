import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { stockListQuerySchema } from '@/lib/validations/inventory.schema';
import { listStock } from '@/lib/services/inventory.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/inventory/stock
 * Daftar stok cabang aktif + master join + lowStock comparison
 * Role: [OWNER, MANAGER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const { searchParams } = new URL(req.url);
  const input = stockListQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const { data, meta } = await listStock(input, auth.role, auth.branchId);

  return ok(data, meta);
});
