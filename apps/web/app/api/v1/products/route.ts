import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { createProductSchema, listQuerySchema } from '@/lib/validations/product.schema';
import { createProduct, listProducts } from '@/lib/services/product.service';

/**
 * GET /api/v1/products
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER) — keputusan A1:
 * katalog master boleh dibaca kasir (POS butuh ini); stok/inventaris
 * adalah resource terpisah dengan guard sendiri di Fase 2.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const { searchParams } = new URL(req.url);
  const input = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listProducts(input.page, input.limit, input.active);
  return ok(data, meta);
});

/**
 * POST /api/v1/products
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = createProductSchema.parse(body);

  const product = await createProduct(input);

  const res = ok(product);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
