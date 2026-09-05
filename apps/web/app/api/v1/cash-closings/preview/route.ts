import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { closingPreviewQuerySchema } from '@/lib/validations/closing.schema';
import { getClosingPreview } from '@/lib/services/closing.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cash-closings/preview
 * Hitung expectedCash real-time sejak closing terakhir, tanpa mengubah database.
 * Permission: CASH_CLOSING_CREATE (OWNER, CASHIER)
 *
 * Keamanan Parameter (Tugas 12.4):
 * - OWNER: boleh filter branch via ?branchId=<uuid> (divalidasi Zod UUID).
 * - CASHIER / non-OWNER: branchId SELALU diambil dari JWT claim sesi (auth.branchId),
 *   parameter URL diabaikan total agar kasir tidak dapat mempreview kas cabang lain.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'CASH_CLOSING_CREATE');

  let targetBranchId = auth.branchId;

  if (auth.role === 'OWNER') {
    const { searchParams } = new URL(req.url);
    const query = closingPreviewQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    targetBranchId = query.branchId ?? auth.branchId;
  }

  const preview = await getClosingPreview(targetBranchId);
  return ok(preview);
});


