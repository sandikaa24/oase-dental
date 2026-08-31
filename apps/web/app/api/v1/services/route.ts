import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { createServiceSchema, listQuerySchema } from '@/lib/validations/service.schema';
import { createService, listServices } from '@/lib/services/service.service';

/**
 * GET /api/v1/services
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const { searchParams } = new URL(req.url);
  const input = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listServices(input.page, input.limit, input.active);
  return ok(data, meta);
});

/**
 * POST /api/v1/services
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = createServiceSchema.parse(body);

  const service = await createService(input);

  const res = ok(service);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
