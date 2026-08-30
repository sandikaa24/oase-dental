import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { ok } from '@/lib/response';
import { setAuthCookies } from '@/lib/cookies';
import { REFRESH_TOKEN_COOKIE } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/errors';
import { refreshSession } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/refresh
 * Auth memakai refresh cookie (bukan access token).
 * Token lama direvoke dan diganti pasangan baru (rotation).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const rawRefreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!rawRefreshToken) {
    throw new UnauthorizedError('Refresh token tidak ditemukan');
  }

  const { user, tokens } = await refreshSession(rawRefreshToken);

  const res = ok({ user });
  setAuthCookies(res, tokens);

  return res;
});