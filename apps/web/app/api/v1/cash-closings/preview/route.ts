import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getClosingPreview } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cash-closings/preview
 * Hitung expectedCash real-time sejak closing terakhir, tanpa mengubah database.
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER)
 */
export const GET = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_CREATE');

  const preview = await getClosingPreview(auth.branchId);
  return ok(preview);
});

