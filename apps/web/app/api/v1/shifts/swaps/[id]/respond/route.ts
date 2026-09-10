import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { ValidationError } from '@/lib/errors';
import { respondSwapPeerSchema } from '@/lib/validations/shift.schema';
import { respondSwapPeer } from '@/lib/services/shift.service';

/**
 * POST /api/v1/shifts/swaps/:id/respond
 * Respons persetujuan rekan kerja atas tukar shift (PEER).
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'ATTENDANCE_SELF');

    if (!auth.employeeId) {
      throw new ValidationError('Akun belum terhubung ke data karyawan');
    }

    const body = await req.json();
    const input = respondSwapPeerSchema.parse(body);
    const ip = getClientIp(req);

    const swap = await respondSwapPeer(
      params.id,
      auth.employeeId,
      input.approved,
      input.note,
      auth.userId,
      ip
    );

    return ok(swap);
  }
);
