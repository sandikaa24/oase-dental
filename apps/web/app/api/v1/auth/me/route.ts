import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getSessionUser } from '@/lib/services/auth.service';

// Route ini membaca cookie, jadi tidak boleh di-prerender statis saat build.
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/me — semua role.
 * Profil user + role + branch aktif + daftar branch assignment.
 * branchId diambil dari JWT claim, tidak pernah dari query/body.
 */
export const GET = withErrorHandler(async () => {
  const auth = await requireAuth();
  const user = await getSessionUser(auth.userId, auth.branchId);

  return ok({ user });
});