import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp, requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { decideLeaveRequestSchema } from '@/lib/validations/leave.schema';
import { decideLeaveRequest } from '@/lib/services/leave.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/leave-requests/:id/decide
 * Memutuskan (APPROVED / REJECTED) pengajuan cuti.
 * Permission: LEAVE_DECIDE (OWNER, MANAGER).
 * Self-decision tolak 403 FORBIDDEN.
 */
export const POST = withErrorHandler(
  async (
    req: NextRequest,
    context?: { params?: Record<string, string | string[]> }
  ) => {
    const auth = await requireAuth();
    requirePermission(auth, 'LEAVE_DECIDE');

    const id = context?.params?.id as string;
    const body = await req.json();
    const input = decideLeaveRequestSchema.parse(body);

    const ip = getClientIp(req);

    const updated = await decideLeaveRequest(
      id,
      input,
      auth.userId,
      auth.employeeId,
      auth.role,
      auth.branchId,
      ip
    );

    return ok(updated);
  }
);
