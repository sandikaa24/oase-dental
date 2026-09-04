import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getGrossProfitReport } from '@/lib/services/report.service';
import { baseReportQuerySchema } from '@/lib/validations/report.schema';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await requireAuth();
  requirePermission(auth, 'SALES_REPORT'); // OWNER only per Q9

  const url = new URL(req.url);
  const query = baseReportQuerySchema.parse(Object.fromEntries(url.searchParams));

  const result = await getGrossProfitReport(
    query.branchId,
    query.dateFrom,
    query.dateTo
  );

  return ok(result);
});
