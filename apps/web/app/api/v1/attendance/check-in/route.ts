import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { checkIn } from '@/lib/services/attendance.service';

/**
 * POST /api/v1/attendance/check-in
 * Check-in absensi pada cabang aktif saat ini (SELF).
 * Permission: [ATTENDANCE_SELF] (semua role).
 */
export const POST = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  const attendance = await checkIn(auth.employeeId, auth.branchId);

  const res = ok(attendance);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
