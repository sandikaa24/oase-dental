import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createLeaveRequestSchema,
  leaveRequestQuerySchema,
} from '@/lib/validations/leave.schema';
import {
  createLeaveRequest,
  getLeaveRequests,
} from '@/lib/services/leave.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/leave-requests
 * Ambil daftar pengajuan cuti/izin.
 * - scope=me / CASHIER / EMPLOYEE: daftar pengajuan milik sendiri (LEAVE_REQUEST).
 * - list all: OWNER, MANAGER (LEAVE_DECIDE).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();

  const { searchParams } = new URL(req.url);
  const input = leaveRequestQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const isSelf =
    input.scope === 'me' ||
    auth.role === 'CASHIER' ||
    auth.role === 'EMPLOYEE';

  if (!isSelf) {
    requirePermission(auth, 'LEAVE_DECIDE');
  } else {
    requirePermission(auth, 'LEAVE_REQUEST');
  }

  const { data, ...meta } = await getLeaveRequests(input, {
    userId: auth.userId,
    employeeId: auth.employeeId,
    role: auth.role,
    activeBranchId: auth.branchId,
  });

  return ok(data, meta);
});

/**
 * POST /api/v1/leave-requests
 * Ajukan cuti/izin/sakit baru.
 * Permission: LEAVE_REQUEST (semua role yang terhubung ke data karyawan).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'LEAVE_REQUEST');

  const body = await req.json();
  const input = createLeaveRequestSchema.parse(body);

  const data = await createLeaveRequest(auth.employeeId, input);

  const res = ok(data);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
