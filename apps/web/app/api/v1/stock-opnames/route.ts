import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  createStockOpnameSchema,
  stockOpnameListQuerySchema,
} from '@/lib/validations/inventory.schema';
import {
  createStockOpname,
  listStockOpnames,
} from '@/lib/services/inventory.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/stock-opnames
 * List stock opname
 * Permission: STOCK_OPNAME_MANAGE [OWNER, MANAGER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'STOCK_OPNAME_MANAGE');

  const { searchParams } = new URL(req.url);
  const input = stockOpnameListQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const { data, meta } = await listStockOpnames(
    input,
    auth.role,
    auth.branchId
  );

  return ok(data, meta);
});

/**
 * POST /api/v1/stock-opnames
 * Create DRAFT Stock Opname + snapshot systemQty
 * Permission: STOCK_OPNAME_MANAGE [OWNER, MANAGER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'STOCK_OPNAME_MANAGE');

  const body = await req.json();
  const input = createStockOpnameSchema.parse(body);

  const result = await createStockOpname(
    input,
    auth.userId,
    auth.role,
    auth.branchId
  );

  const res = ok(result);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
