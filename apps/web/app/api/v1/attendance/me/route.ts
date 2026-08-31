import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { attendanceMeQuerySchema } from '@/lib/validations/attendance.schema';
import { getMyAttendance } from '@/lib/services/attendance.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/attendance/me
 * Riwayat absensi sendiri.
 * Query: ?month=YYYY-MM (default: bulan berjalan WIB).
 * Permission: [ATTENDANCE_SELF] (semua role).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  const { searchParams } = new URL(req.url);
  const input = attendanceMeQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const data = await getMyAttendance(auth.employeeId, input.month);

  return ok(data);
});
