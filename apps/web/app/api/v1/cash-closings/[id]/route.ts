import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getClosingById } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cash-closings/:id
 * Detail closing tunggal + IDOR guard.
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER)
 */
export const GET = withErrorHandler(async (
  _req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_CREATE');

  const closing = await getClosingById(params.id, auth.role, auth.branchId);
  return ok(closing);
});
