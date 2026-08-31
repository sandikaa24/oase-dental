import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getPosCatalog } from '@/lib/services/pos.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const posCatalogQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['SERVICE', 'PRODUCT']).optional(),
  categoryId: z.string().uuid().optional(),
});

/**
 * GET /api/v1/pos/catalog
 * Permission: POS_CREATE (OWNER, CASHIER), MANAGER
 * Mengambil katalog item yang dapat dijual di POS (layanan & produk aktif beserta stok cabang aktif kasir).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER', 'CASHIER');

  const { searchParams } = new URL(req.url);
  const input = posCatalogQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const catalog = await getPosCatalog(auth.branchId, input);

  return ok(catalog);
});
