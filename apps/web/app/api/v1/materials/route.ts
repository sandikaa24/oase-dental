import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { createMaterialSchema, listQuerySchema } from '@/lib/validations/material.schema';
import { createMaterial, listMaterials } from '@/lib/services/material.service';

/**
 * GET /api/v1/materials
 * Permission: MASTER_DATA_READ (OWNER, MANAGER, CASHIER) — keputusan A1:
 * ini katalog master bahan, BUKAN data stok. Stok/opname/stock-in adalah
 * resource Fase 2 dengan guard terpisah.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_READ);

  const { searchParams } = new URL(req.url);
  const input = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));
  const { data, ...meta } = await listMaterials(input.page, input.limit, input.active);
  return ok(data, meta);
});

/**
 * POST /api/v1/materials
 * Permission: MASTER_DATA_MANAGE (OWNER).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.MASTER_DATA_MANAGE);

  const body = await req.json();
  const input = createMaterialSchema.parse(body);

  const material = await createMaterial(input);

  const res = ok(material);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
