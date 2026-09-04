import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { setAuthCookies } from '@/lib/cookies';
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
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = loginSchema.parse(body);
  const ip = getClientIp(req);
  const rateLimitKey = getRateLimitKey(ip, input.email);

  // Cek batas percobaan gagal (in-memory sliding window, 5 gagal / 15 menit)
  checkLoginRateLimit(rateLimitKey);

  try {
    const { user, tokens } = await login({
      email: input.email,
      password: input.password,
      ip,
    });

    recordLoginSuccess(rateLimitKey);

    const res = ok({ user });
    setAuthCookies(res, tokens);

    return res;
  } catch (error) {
    recordLoginFailure(rateLimitKey);
    throw error;
  }
});