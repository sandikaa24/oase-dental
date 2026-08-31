import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateBranchSchema } from '@/lib/validations/branch.schema';
import { getBranchById, updateBranch } from '@/lib/services/branch.service';

/**
 * GET /api/v1/branches/:id
 * Get branch detail.
 * Permission: [OWNER]
 */
export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  // OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular
  requireRole(auth, 'OWNER');

  const branch = await getBranchById(params.id);
  return ok(branch);
});

/**
 * PATCH /api/v1/branches/:id
 * Update branch.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  // OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = updateBranchSchema.parse(body);

  const branch = await updateBranch(params.id, input);
  return ok(branch);
});
