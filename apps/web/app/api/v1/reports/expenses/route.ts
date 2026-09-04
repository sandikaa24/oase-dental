import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getExpensesReport } from '@/lib/services/report.service';
import { expenseReportQuerySchema } from '@/lib/validations/report.schema';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await requireAuth();
  requirePermission(auth, 'EXPENSE_REPORT');

  const url = new URL(req.url);
  const query = expenseReportQuerySchema.parse(Object.fromEntries(url.searchParams));

  // Role check for branch filter
  let branchId: string | undefined = query.branchId;
  if (auth.role !== 'OWNER') {
    branchId = auth.branchId || undefined; // Force manager to active branch
  }

  const { meta, ...data } = await getExpensesReport(
    branchId,
    query.dateFrom,
    query.dateTo,
    query.category,
    query.page,
    query.limit
  );

  return ok(data, meta);
});
