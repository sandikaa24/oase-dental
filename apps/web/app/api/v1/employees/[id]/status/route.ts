import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { employeeStatusSchema } from '@/lib/validations/employee.schema';
import { setEmployeeStatus } from '@/lib/services/employee.service';

/**
 * PATCH /api/v1/employees/:id/status
 * Aktifkan atau nonaktifkan karyawan (soft delete via active flag).
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const { active } = employeeStatusSchema.parse(body);
    const ip = getClientIp(req);

    const employee = await setEmployeeStatus(params.id, active, auth.userId, ip);
    return ok(employee);
  }
);
