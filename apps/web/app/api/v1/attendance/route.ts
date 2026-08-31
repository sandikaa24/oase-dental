import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { attendanceListQuerySchema } from '@/lib/validations/attendance.schema';
import { listAttendances } from '@/lib/services/attendance.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/attendance
 * List absensi semua karyawan.
 * Permission: [ATTENDANCE_VIEW_ALL] (OWNER, MANAGER).
 * Filter: ?date=YYYY-MM-DD, ?branchId (OWNER), ?employeeId, ?page, ?limit
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_VIEW_ALL');

  const { searchParams } = new URL(req.url);
  const input = attendanceListQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listAttendances(
    {
      page: input.page,
      limit: input.limit,
      date: input.date,
      branchId: input.branchId,
      employeeId: input.employeeId,
    },
    auth.role,
    auth.branchId
  );

  return ok(data, meta);
});
