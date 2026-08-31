import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { updateMaterialSchema } from '@/lib/validations/material.schema';
import { deleteMaterial, getMaterialById, updateMaterial } from '@/lib/services/material.service';

/**
 * GET /api/v1/materials/:id
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER) — keputusan A1.
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const material = await getMaterialById(params.id);
  return ok(material);
});

/**
 * PATCH /api/v1/materials/:id
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = updateMaterialSchema.parse(body);

  const material = await updateMaterial(params.id, input);
  return ok(material);
});

/**
 * DELETE /api/v1/materials/:id
 * Soft delete jika sudah dipakai InventoryMovement, hard delete jika belum (B1).
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const result = await deleteMaterial(params.id);
  return ok({ id: params.id, deleted: true, mode: result.mode });
});
