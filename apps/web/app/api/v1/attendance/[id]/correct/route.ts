import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { attendanceCorrectSchema } from '@/lib/validations/attendance.schema';
import { correctAttendance } from '@/lib/services/attendance.service';

/**
 * POST /api/v1/attendance/:id/correct
 * Koreksi manual absensi oleh OWNER.
 * Permission: [OWNER]
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const input = attendanceCorrectSchema.parse(body);
    const ip = getClientIp(req);

    const attendance = await correctAttendance(params.id, input, auth.userId, ip);

    return ok(attendance);
  }
);
