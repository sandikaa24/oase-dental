import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getAuditLogs } from '@/lib/services/audit-log.service';
import { auditLogQuerySchema } from '@/lib/validations/report.schema';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: Request) => {
  const auth = await requireAuth();
  requirePermission(auth, 'AUDIT_LOG_VIEW'); // OWNER only

  const url = new URL(req.url);
  const query = auditLogQuerySchema.parse(Object.fromEntries(url.searchParams));

  const result = await getAuditLogs(
    query.dateFrom,
    query.dateTo,
    query.action,
    query.entity,
    query.actorId,
    query.page,
    query.limit
  );

  return ok(result.data, result.meta);
});
