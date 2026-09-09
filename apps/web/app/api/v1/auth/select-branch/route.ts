import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp, requireAuth } from '@/lib/middleware';
import { ok } from '@/lib/response';
import {
  setAuthCookies,
  setBranchContextCookie,
  setRememberedBranchCookie,
  clearRememberedBranchCookie,
} from '@/lib/cookies';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth';
import { selectBranchSchema } from '@/lib/validations/auth.schema';
import { selectBranch } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/select-branch (Amandemen A1: satu pintu untuk seluruh role).
 * - OWNER: dapat memilih "ALL" (Semua Cabang) atau cabang fisik spesifik.
 * - Non-OWNER: hanya dapat memilih cabang dalam daftar penempatan aktifnya.
 * - Mengatur session cookie oase_branch_context (TANPA TTL 15m).
 * - Bila remember: true, menyimpan cookie oase_remembered_branch (30 hari, Amandemen A2).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = selectBranchSchema.parse(body);

  const auth = await requireAuth();
  const rawRefreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  const { user, tokens, branchContext } = await selectBranch({
    userId: auth.userId,
    role: auth.role,
    branchId: input.branchId,
    remember: input.remember,
    rawRefreshToken,
    ip: getClientIp(req),
  });

  const res = ok({ user, branchContext });
  setAuthCookies(res, tokens);
  setBranchContextCookie(res, branchContext);

  if (input.remember === true) {
    setRememberedBranchCookie(res, branchContext);
  } else if (input.remember === false) {
    clearRememberedBranchCookie(res);
  }

  return res;
});
