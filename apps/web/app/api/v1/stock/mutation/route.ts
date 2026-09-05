import { type NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { stockMutationSchema } from '@/lib/validations/stock.schema';
import { recordStockMutation, type UserContext } from '@/lib/services/stock.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/stock/mutation
 * Catat mutasi stok manual (IN / OUT / ADJUSTMENT)
 * Role: [OWNER, MANAGER]
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER', 'MANAGER');

  const body = await req.json();
  const input = stockMutationSchema.parse(body);
  const ip = getClientIp(req);

  const userContext: UserContext = {
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    activeBranchId: auth.branchId,
    employeeId: auth.employeeId,
  };

  const result = await recordStockMutation(input, userContext, ip);
  return NextResponse.json({ success: true, data: result }, { status: 201 });
});
