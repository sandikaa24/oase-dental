import { type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateProductSchema } from '@/lib/validations/stock.schema';
import { getProductById, updateProduct, deleteProduct } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/v1/products/:id
 * Detail produk
 * Role: [OWNER, MANAGER, CASHIER]
 */
export const GET = withErrorHandler(async (_req: NextRequest, { params }: RouteContext) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER', 'CASHIER');

  const product = await getProductById(params.id);
  return ok(product);
});

/**
 * PUT /api/v1/products/:id
 * Update produk
 * Role: [OWNER, MANAGER]
 */
export const PUT = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const body = await req.json();
  const input = updateProductSchema.parse(body);
  const ip = getClientIp(req);

  const updated = await updateProduct(params.id, input, auth.userId, ip);
  return ok(updated);
});

/**
 * DELETE /api/v1/products/:id
 * Soft delete produk (set isActive = false)
 * Role: [OWNER, MANAGER]
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const ip = getClientIp(req);
  const deleted = await deleteProduct(params.id, auth.userId, ip);
  return ok({ id: deleted.id, isActive: deleted.isActive });
});
