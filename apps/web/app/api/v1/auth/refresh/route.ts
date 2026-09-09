import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { ok } from '@/lib/response';
import { setAuthCookies, setBranchContextCookie } from '@/lib/cookies';
import { REFRESH_TOKEN_COOKIE, BRANCH_CONTEXT_COOKIE } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/errors';
import { refreshSession } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/refresh
 * Auth memakai refresh cookie (bukan access token).
 * Token lama direvoke dan diganti pasangan baru (rotation).
 * Amandemen A2: Menyegarkan session cookie oase_branch_context bersama rotasi token.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const rawRefreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token tidak ditemukan');
  }

  const currentBranchContext = req.cookies.get(BRANCH_CONTEXT_COOKIE)?.value ?? null;

  const { user, tokens, branchContext } = await refreshSession(
    rawRefreshToken,
    currentBranchContext,
  );

  const res = ok({ user, branchContext });
  setAuthCookies(res, tokens);

  if (branchContext) {
    setBranchContextCookie(res, branchContext);
  }

  return res;
});