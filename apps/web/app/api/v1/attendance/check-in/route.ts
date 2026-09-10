import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, requireBranchContext, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { checkIn } from '@/lib/services/attendance.service';
import { attendanceCheckInSchema } from '@/lib/validations/attendance.schema';
import { ValidationError } from '@/lib/errors';

/**
 * POST /api/v1/attendance/check-in
 * Check-in absensi pada cabang aktif/shift saat ini (SELF).
 * Body opsional/wajib: { latitude, longitude, accuracy }
 * Permission: [ATTENDANCE_SELF] (semua role).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'ATTENDANCE_SELF');

  if (!auth.employeeId) {
    throw new ValidationError('Akun belum terhubung ke data karyawan untuk melakukan absensi');
  }

  let coords: { latitude?: number | null; longitude?: number | null; accuracy?: number | null } | undefined;
  try {
    const text = await req.text();
    if (text && text.trim().length > 0) {
      const json = JSON.parse(text);
      coords = attendanceCheckInSchema.parse(json);
    }
  } catch (err: unknown) {
    // Jika body ada tapi bukan JSON valid atau tidak sesuai schema, biarkan Zod melempar error
    if (err instanceof SyntaxError) {
      throw new ValidationError('Format payload JSON tidak valid');
    }
    throw err;
  }

  const effectiveBranchId = await requireBranchContext(auth, { allowAllForOwner: false });
  const ip = getClientIp(req);
  const attendance = await checkIn(auth.employeeId, effectiveBranchId, coords, auth.userId, ip);

  const res = ok(attendance);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});

