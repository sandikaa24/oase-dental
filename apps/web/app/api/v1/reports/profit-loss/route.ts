import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getProfitLossReport } from '@/lib/services/report.service';
import { profitLossQuerySchema } from '@/lib/validations/report.schema';
import { BranchAccessDeniedError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const url = new URL(req.url);
  const query = profitLossQuerySchema.parse(Object.fromEntries(url.searchParams));

  // Anti-IDOR: Non-OWNER (MANAGER) dikunci pada cabang aktifnya
  let effectiveBranchId = query.branchId;
  if (auth.role === 'MANAGER') {
    if (!auth.branchId) {
      throw new BranchAccessDeniedError('Pengguna tidak memiliki cabang aktif');
    }
    if (query.branchId && query.branchId !== auth.branchId) {
      throw new BranchAccessDeniedError('Tidak punya akses ke cabang ini');
    }
    effectiveBranchId = auth.branchId;
  }

  const result = await getProfitLossReport(
    effectiveBranchId,
    query.dateFrom,
    query.dateTo,
    query.page,
    query.limit
  );

  return ok(result);
});
