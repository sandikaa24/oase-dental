import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, requireBranchContext } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { checkIn } from '@/lib/services/attendance.service';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/v1/attendance/check-in
 * Check-in absensi pada cabang aktif saat ini (SELF).
 * Permission: [ATTENDANCE_SELF] (semua role).
 */
export const POST = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  if (!auth.employeeId) {
    throw new ValidationError('Akun belum terhubung ke data karyawan untuk melakukan absensi');
  }

  const effectiveBranchId = await requireBranchContext(auth, { allowAllForOwner: false });
  const attendance = await checkIn(auth.employeeId, effectiveBranchId);

  const res = ok(attendance);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});

