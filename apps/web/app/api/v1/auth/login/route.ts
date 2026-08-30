import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { setAuthCookies } from '@/lib/cookies';
import { loginSchema } from '@/lib/validations/auth.schema';
import { login } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/login — publik (tidak butuh auth).
 * Urutan: Zod parse → handler service → set cookie → response helper.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = loginSchema.parse(body);

  const { user, tokens } = await login({
    email: input.email,
    password: input.password,
    ip: getClientIp(req),
  });

  const res = ok({ user });
  setAuthCookies(res, tokens);

  return res;
});