import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { deleteShiftAssignment } from '@/lib/services/shift.service';

/**
 * DELETE /api/v1/shifts/assignments/:id
 * Hapus penugasan shift kerja oleh OWNER.
 */
export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const ip = getClientIp(req);
    await deleteShiftAssignment(params.id, auth.userId, ip);

    return ok({ message: 'Penugasan shift berhasil dihapus' });
  }
);
