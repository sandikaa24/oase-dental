import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { createCategorySchema, listQuerySchema } from '@/lib/validations/category.schema';
import { createCategory, listCategories } from '@/lib/services/category.service';

/**
 * GET /api/v1/categories
 * List kategori (pagination + filter active).
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const { searchParams } = new URL(req.url);
  const input = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listCategories(input.page, input.limit, input.active);

  return ok(data, meta);
});

/**
 * POST /api/v1/categories
 * Create kategori.
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = createCategorySchema.parse(body);

  const category = await createCategory(input);

  // POST create -> 201; helper ok default 200, jadi dibungkus ulang dengan status 201.
  const res = ok(category);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
