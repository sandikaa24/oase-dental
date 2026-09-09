import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp } from '@/lib/middleware';
import { ok, fail } from '@/lib/response';
import {
  setAuthCookies,
  clearAuthCookies,
  setBranchContextCookie,
  clearBranchContextCookie,
  clearRememberedBranchCookie,
} from '@/lib/cookies';
import { REMEMBERED_BRANCH_COOKIE } from '@/lib/auth';
import { AccountDisabledError } from '@/lib/errors';
import { loginSchema } from '@/lib/validations/auth.schema';
import { login } from '@/lib/services/auth.service';
import {
  checkLoginRateLimit,
  getRateLimitKey,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/rate-limit';

/**
 * POST /api/v1/auth/login — publik (tidak butuh auth).
 * Urutan: Zod parse → Rate-limit check → handler service → set cookie → response helper.
 * - Single-branch: otomatis set oase_branch_context
 * - Multi-branch: re-validasi oase_remembered_branch (Amandemen A2), jika valid set oase_branch_context,
 *   jika tidak dibersihkan agar diarahkan ke /select-branch.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = loginSchema.parse(body);
  const ip = getClientIp(req);
  const rateLimitKey = getRateLimitKey(ip, input.identifier);

  // Cek batas percobaan gagal (in-memory sliding window, 5 gagal / 15 menit)
  checkLoginRateLimit(rateLimitKey);

  const rememberedBranch = req.cookies.get(REMEMBERED_BRANCH_COOKIE)?.value ?? null;

  try {
    const { user, tokens, branchContext } = await login({
      identifier: input.identifier,
      password: input.password,
      ip,
      rememberedBranch,
    });

    recordLoginSuccess(rateLimitKey);

    const res = ok({ user, branchContext });
    setAuthCookies(res, tokens);

    if (branchContext) {
      setBranchContextCookie(res, branchContext);
    } else {
      clearBranchContextCookie(res);
    }

    // AMANDEMEN D4: Cookie remembered_branch lama diabaikan secara aman pada alur login (tidak auto-apply)

    return res;
  } catch (error) {
    recordLoginFailure(rateLimitKey);
    if (error instanceof AccountDisabledError) {
      const res = fail(error);
      clearAuthCookies(res);
      clearBranchContextCookie(res);
      clearRememberedBranchCookie(res);
      return res;
    }
    throw error;
  }
});