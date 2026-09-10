import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { ValidationError } from '@/lib/errors';
import {
  createSwapRequestSchema,
  listSwapsQuerySchema,
} from '@/lib/validations/shift.schema';
import {
  listSwapRequests,
  createSwapRequest,
} from '@/lib/services/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/shifts/swaps
 * List permohonan tukar shift.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();

  const { searchParams } = new URL(req.url);
  const input = listSwapsQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listSwapRequests(
    {
      employeeId: auth.employeeId ?? undefined,
      status: input.status,
      date: input.date,
      page: input.page,
      limit: input.limit,
    },
    auth.role
  );

  return ok(data, meta);
});

/**
 * POST /api/v1/shifts/swaps
 * Pengajuan tukar shift oleh karyawan (SELF).
 * Permission: [ATTENDANCE_SELF]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  if (!auth.employeeId) {
    throw new ValidationError('Akun belum terhubung ke data karyawan untuk mengajukan tukar shift');
  }

  const body = await req.json();
  const input = createSwapRequestSchema.parse(body);
  const ip = getClientIp(req);

  const swap = await createSwapRequest(auth.employeeId, input, auth.userId, ip);

  const res = ok(swap);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
