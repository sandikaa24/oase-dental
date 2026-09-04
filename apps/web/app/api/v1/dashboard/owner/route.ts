import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getOwnerDashboard } from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'SALES_REPORT'); // OWNER only per PRD

  const result = await getOwnerDashboard();

  return ok(result);
});
