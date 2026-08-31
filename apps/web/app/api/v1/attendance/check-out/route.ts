import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { checkOut } from '@/lib/services/attendance.service';

/**
 * POST /api/v1/attendance/check-out
 * Check-out absensi pada cabang aktif saat ini (SELF).
 * Permission: [ATTENDANCE_SELF] (semua role).
 */
export const POST = withErrorHandler(async () => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  const attendance = await checkOut(auth.employeeId, auth.branchId);

  return ok(attendance);
});
