import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createEmployeeSchema,
  employeeListQuerySchema,
} from '@/lib/validations/employee.schema';
import { createEmployee, listEmployees } from '@/lib/services/employee.service';

/**
 * GET /api/v1/employees
 * List karyawan dengan filter (branch, active, search name).
 * Permission: [OWNER, MANAGER] — read akses per API-CONTRACT §4 header.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const { searchParams } = new URL(req.url);
  const input = employeeListQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listEmployees(input.page, input.limit, {
    active: input.active,
    branchId: input.branchId,
    search: input.search,
  });

  return ok(data, meta);
});

/**
 * POST /api/v1/employees
 * Buat karyawan baru. Body: { name, phone?, position, branchIds: [uuid] }
 * Permission: [OWNER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = createEmployeeSchema.parse(body);
  const ip = getClientIp(req);

  const employee = await createEmployee(input, auth.userId, ip);

  const res = ok(employee);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
