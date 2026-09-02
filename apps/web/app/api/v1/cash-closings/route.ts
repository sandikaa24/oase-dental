import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { closingListQuerySchema, createClosingSchema } from '@/lib/validations/closing.schema';
import { listClosings, createClosing } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cash-closings
 * List closing branch aktif (CASHIER) atau semua/filter branch (OWNER).
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_CREATE');

  const { searchParams } = new URL(req.url);
  const input = closingListQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listClosings(
    {
      page: input.page,
      limit: input.limit,
      status: input.status,
      branchId: input.branchId,
    },
    auth.role,
    auth.branchId
  );

  return ok(data, meta);
});

/**
 * POST /api/v1/cash-closings
 * Buat & tutup kas sekaligus.
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_CREATE');

  const body = await req.json();
  const input = createClosingSchema.parse(body);

  const closing = await createClosing(input, auth.userId, auth.branchId, getClientIp(req));

  const res = ok(closing);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
