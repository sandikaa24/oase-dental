import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { listProducts } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products
 * Daftar produk (master item independen)
 * Role: [OWNER, MANAGER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

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
 * Guard Satu Pintu: Ditolak.
 * Pembuatan item barang hanya dapat dilakukan melalui Master Data Bahan Klinis (/api/v1/materials).
 */
export const POST = withErrorHandler(async () => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  return NextResponse.json(
    {
      success: false,
      code: 'FORBIDDEN',
      message: 'Pembuatan item barang hanya dapat dilakukan melalui Master Data Bahan Klinis (/api/v1/materials)',
    },
    { status: 403 }
  );
});
