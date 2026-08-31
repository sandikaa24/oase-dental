import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { createBranchSchema, listQuerySchema } from '@/lib/validations/branch.schema';
import { createBranch, listBranches } from '@/lib/services/branch.service';

/**
 * GET /api/v1/branches
 * List branches (dengan pagination, filter active).
 * Permission: [OWNER]
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  // OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular
  requireRole(auth, 'OWNER');

  const { searchParams } = new URL(req.url);
  const input = listQuerySchema.parse(Object.fromEntries(searchParams.entries()));

  const { data, ...meta } = await listBranches(input.page, input.limit, input.active);

  return ok(data, meta);
});

/**
 * POST /api/v1/branches
 * Create branch.
 * Permission: [OWNER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  // OWNER-only; BRANCH_MANAGE tersedia jika nanti perlu permission-granular
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = createBranchSchema.parse(body);

  const branch = await createBranch(input);

  // POST create -> 201; helper ok default 200, jadi dibungkus ulang dengan status 201.
  const res = ok(branch);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
