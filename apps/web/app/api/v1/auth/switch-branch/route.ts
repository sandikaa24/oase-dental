import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp, requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { setAuthCookies } from '@/lib/cookies';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth';
import { switchBranchSchema } from '@/lib/validations/auth.schema';
import { switchBranch } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/switch-branch — semua role non-OWNER.
 * Urutan: Zod parse → auth → role check → handler → set cookie → response.
 * Branch tujuan wajib ada di assignment user (dicek di service layer).
 * Refresh token lama diambil dari cookie agar bisa direvoke oleh service (rotation).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = switchBranchSchema.parse(body);

  const auth = await requireAuth();
  requireRole(auth, 'MANAGER', 'CASHIER', 'EMPLOYEE');

  const rawRefreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  const { user, tokens } = await switchBranch({
    userId: auth.userId,
    role: auth.role,
    branchId: input.branchId,
    rawRefreshToken,
    ip: getClientIp(req),
  });

  const res = ok({ user });
  setAuthCookies(res, tokens);

  return res;
});