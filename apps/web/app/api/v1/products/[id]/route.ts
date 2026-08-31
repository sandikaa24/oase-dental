import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { updateProductSchema } from '@/lib/validations/product.schema';
import { deleteProduct, getProductById, updateProduct } from '@/lib/services/product.service';

/**
 * GET /api/v1/products/:id
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER) — keputusan A1.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const product = await getProductById(params.id);
  return ok(product);
});

/**
 * PATCH /api/v1/products/:id
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = updateProductSchema.parse(body);

  const product = await updateProduct(params.id, input);
  return ok(product);
});

/**
 * DELETE /api/v1/products/:id
 * Soft delete jika sudah dipakai transaksi/inventory, hard delete jika belum (B1).
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const result = await deleteProduct(params.id);
  return ok({ id: params.id, deleted: true, mode: result.mode });
});
