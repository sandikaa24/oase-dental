import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { cancelLeaveRequest } from '@/lib/services/leave.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/leave-requests/:id/cancel
 * Pembatalan permohonan cuti berstatus PENDING oleh pengaju sendiri.
 * Record PENDING dihapus (hard delete) agar rentang tanggal bebas kembali.
 */
export const POST = withErrorHandler(
  async (
    _req: NextRequest,
    context?: { params?: Record<string, string | string[]> }
  ) => {
    const auth = await requireAuth();
    requirePermission(auth, 'LEAVE_REQUEST');

    const id = context?.params?.id as string;
    const res = await cancelLeaveRequest(id, auth.employeeId);

    return ok(res);
  }
);
