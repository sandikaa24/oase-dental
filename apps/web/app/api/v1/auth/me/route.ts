import { cookies } from 'next/headers';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { getSessionUser } from '@/lib/services/auth.service';
import { BRANCH_CONTEXT_COOKIE } from '@/lib/auth';

// Route ini membaca cookie, jadi tidak boleh di-prerender statis saat build.
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/auth/me — semua role.
 * Profil user + role + branch aktif + daftar branch assignment + branchContext aktif.
 * branchId diambil dari JWT claim, tidak pernah dari query/body.
 */
export const GET = withErrorHandler(async () => {
  const auth = await requireAuth();
  const store = cookies();
  const branchContext = store.get(BRANCH_CONTEXT_COOKIE)?.value ?? auth.branchId;
  const user = await getSessionUser(auth.userId, auth.branchId, branchContext);

  return ok({ user });
});