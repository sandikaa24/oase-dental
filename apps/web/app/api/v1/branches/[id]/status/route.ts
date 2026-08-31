import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { statusSchema } from '@/lib/validations/branch.schema';
import { setStatus } from '@/lib/services/branch.service';

/**
 * PATCH /api/v1/branches/:id/status
 * Update branch status (active).
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  // OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = statusSchema.parse(body);

  const branch = await setStatus(params.id, input.active);
  return ok(branch);
});
