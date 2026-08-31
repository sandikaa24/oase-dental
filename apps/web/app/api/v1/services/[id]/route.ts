import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { updateServiceSchema } from '@/lib/validations/service.schema';
import { deleteService, getServiceById, updateService } from '@/lib/services/service.service';

/**
 * GET /api/v1/services/:id
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER).
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const service = await getServiceById(params.id);
  return ok(service);
});

/**
 * PATCH /api/v1/services/:id
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = updateServiceSchema.parse(body);

  const service = await updateService(params.id, input);
  return ok(service);
});

/**
 * DELETE /api/v1/services/:id
 * Soft delete jika sudah dipakai transaksi, hard delete jika belum (keputusan B1).
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const result = await deleteService(params.id);
  return ok({ id: params.id, deleted: true, mode: result.mode });
});
