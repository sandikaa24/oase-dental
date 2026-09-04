import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getSalesReport } from '@/lib/services/report.service';
import { salesReportQuerySchema } from '@/lib/validations/report.schema';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await requireAuth();
  requirePermission(auth, 'SALES_REPORT'); // OWNER only per Q9

  const url = new URL(req.url);
  const query = salesReportQuerySchema.parse(Object.fromEntries(url.searchParams));

  // PRD: Owner can filter by branchId
  const branchId = query.branchId;

  const { meta, ...data } = await getSalesReport(
    branchId,
    query.dateFrom,
    query.dateTo,
    query.method,
    query.page,
    query.limit
  );

  return ok(data, meta);
});
