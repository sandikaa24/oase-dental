import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { decideSwapOwnerSchema } from '@/lib/validations/shift.schema';
import { decideSwapOwner } from '@/lib/services/shift.service';

/**
 * POST /api/v1/shifts/swaps/:id/decide
 * Keputusan akhir Owner atas pengajuan tukar shift (OWNER).
 * Jika approved=true -> jadwal ShiftAssignment kedua staf otomatis bertukar.
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const input = decideSwapOwnerSchema.parse(body);
    const ip = getClientIp(req);

    const swap = await decideSwapOwner(
      params.id,
      input.approved,
      auth.userId,
      input.note,
      ip
    );

    return ok(swap);
  }
);
