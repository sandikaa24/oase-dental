import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getCashierDashboard } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/dashboard/cashier
 * Ringkasan harian kasir: transaksi hari ini, omset, breakdown metode bayar, status closing.
 * Permission: POS_CREATE (OWNER, CASHIER)
 */
export const GET = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'POS_CREATE');

  const dashboard = await getCashierDashboard(auth.branchId);
  return ok(dashboard);
});

