import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { clearAuthCookies } from '@/lib/cookies';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, verifyAccessToken } from '@/lib/auth';
import { logout } from '@/lib/services/auth.service';

/**
 * POST /api/v1/auth/logout
 * Sengaja tidak mewajibkan access token valid: logout harus tetap berhasil
 * walau access token sudah kedaluwarsa, agar cookie selalu bisa dibersihkan.
 * Refresh token direvoke bila cookie-nya ada.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const rawRefreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  const rawAccessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  // Ambil actorId untuk audit log bila access token masih bisa diverifikasi.
  let actorId: string | null = null;
  if (rawAccessToken) {
    try {
      const payload = await verifyAccessToken(rawAccessToken);
      actorId = payload.userId;
    } catch {
      // Token kedaluwarsa/invalid: lanjutkan logout tanpa audit actor.
      actorId = null;
    }
  }

  await logout({ rawRefreshToken, actorId, ip: getClientIp(req) });

  const res = ok({ message: 'Logout berhasil' });
  clearAuthCookies(res);

  return res;
});