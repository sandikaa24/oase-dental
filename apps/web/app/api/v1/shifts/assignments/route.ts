import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createShiftAssignmentSchema,
  listShiftsQuerySchema,
} from '@/lib/validations/shift.schema';
import {
  listShiftAssignments,
  createShiftAssignment,
} from '@/lib/services/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/shifts/assignments
 * List penugasan shift kerja staf klinik.
 * Akses: Semua pengguna terotentikasi.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth();

  const { searchParams } = new URL(req.url);
  const input = listShiftsQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const assignments = await listShiftAssignments({
    branchId: input.branchId,
    date: input.date,
    startDate: input.startDate,
    endDate: input.endDate,
    employeeId: input.employeeId,
  });

  return ok(assignments);
});

/**
 * POST /api/v1/shifts/assignments
 * Penugasan shift harian karyawan oleh OWNER.
 * Akses: OWNER saja.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = createShiftAssignmentSchema.parse(body);
  const ip = getClientIp(req);

  const assignment = await createShiftAssignment(input, auth.userId, ip);

  const res = ok(assignment);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
