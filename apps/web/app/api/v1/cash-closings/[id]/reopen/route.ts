import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { reopenClosingSchema } from '@/lib/validations/closing.schema';
import { reopenClosing } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/cash-closings/:id/reopen
 * Buka kembali closing yang CLOSED. Hanya OWNER (CASH_CLOSING_REOPEN).
 * Body: { reason: string (min 10 char) }
 */
export const POST = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_REOPEN');

  const body = await req.json();
  const input = reopenClosingSchema.parse(body);

  const closing = await reopenClosing(
    params.id,
    input.reason,
    auth.userId,
    auth.role,
    auth.branchId,
    getClientIp(req)
  );

  return ok(closing);
});
