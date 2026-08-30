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
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = createBranchSchema.parse(body);

  const branch = await createBranch(input);

  // According to API-CONTRACT typically returns 201. ok() returns 200 by default.
  // Wait, let's just use ok() and if we need 201 we can do it, but ok() returns 200.
  // We can return a custom response if needed, but PRD uses ok() helper.
  // Wait, the test says "POST /branches -> 201".
  // Let's check if we can add status to ok(). `ok` in response.ts does not accept status.
  // But wait, the PRD doesn't explicitly mention 201 in the helper, it says "Response 201: data transaksi lengkap" for transactions.
  // I will just use NextResponse directly for 201, or return ok() and modify the status.
  const res = ok(branch);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
