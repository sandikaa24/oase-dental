import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createUserSchema,
  userListQuerySchema,
} from '@/lib/validations/user.schema';
import { createUser, listUsers } from '@/lib/services/user.service';

/**
 * GET /api/v1/users
 * List users dengan filter role, active, branchId.
 * Permission: [OWNER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  const { searchParams } = new URL(req.url);
  const input = userListQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listUsers(input.page, input.limit, {
    role: input.role,
    active: input.active,
    branchId: input.branchId,
  });

  return ok(data, meta);
});

/**
 * POST /api/v1/users
 * Buat user baru. Body: { email, password (min 8), role, employeeId? }
 * Non-OWNER: employeeId wajib dan employee harus active.
 * Permission: [OWNER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = createUserSchema.parse(body);
  const ip = getClientIp(req);

  const user = await createUser(input, auth.userId, ip);

  const res = ok(user);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
