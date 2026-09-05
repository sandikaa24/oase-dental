import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { createProductSchema } from '@/lib/validations/stock.schema';
import { listProducts, createProduct } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products
 * Daftar produk (master item independen)
 * Role: [OWNER, MANAGER, CASHIER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER', 'CASHIER');

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const category = searchParams.get('category') || undefined;
  const isActiveParam = searchParams.get('isActive');
  const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const { products, meta } = await listProducts({
    search,
    category,
    isActive,
    page,
    limit,
  });

  return ok(products, meta);
});

/**
 * POST /api/v1/products
 * Tambah master produk
 * Role: [OWNER, MANAGER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const body = await req.json();
  const input = createProductSchema.parse(body);
  const ip = getClientIp(req);

  const product = await createProduct(input, auth.userId, ip);
  return NextResponse.json({ success: true, data: product }, { status: 201 });
});
