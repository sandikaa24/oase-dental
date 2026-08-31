import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { updateCategorySchema } from '@/lib/validations/category.schema';
import { getCategoryById, updateCategory } from '@/lib/services/category.service';

/**
 * GET /api/v1/categories/:id
 * Detail kategori.
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER).
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const category = await getCategoryById(params.id);
  return ok(category);
});

/**
 * PATCH /api/v1/categories/:id
 * Update kategori (termasuk toggle active = soft delete keputusan C).
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = updateCategorySchema.parse(body);

  const category = await updateCategory(params.id, input);
  return ok(category);
});
