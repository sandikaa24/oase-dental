import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateEmployeeSchema } from '@/lib/validations/employee.schema';
import {
  getEmployeeById,
  updateEmployee,
} from '@/lib/services/employee.service';

/**
 * GET /api/v1/employees/:id
 * Detail karyawan.
 * Permission: [OWNER, MANAGER]
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER', 'MANAGER');

    const employee = await getEmployeeById(params.id);
    return ok(employee);
  }
);

/**
 * PATCH /api/v1/employees/:id
 * Update karyawan (partial). Jika branchIds disertakan → REPLACE semantics.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const input = updateEmployeeSchema.parse(body);
    const ip = getClientIp(req);

    const employee = await updateEmployee(params.id, input, auth.userId, ip);
    return ok(employee);
  }
);
