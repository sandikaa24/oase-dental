import { withErrorHandler } from '@/lib/error-handler';
import { ok } from '@/lib/response';
import { getPublicBranchHours } from '@/lib/services/public.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/branch-hours
 * Endpoint publik (tanpa autentikasi 🔓)
 * Mengambil informasi cabang aktif dan jam operasional per-hari-per-shift dari database.
 * Whitelist kolom aman (tanpa koordinat geofence, radius, atau data internal staf).
 */
export const GET = withErrorHandler(async () => {
  const branchHours = await getPublicBranchHours();
  return ok(branchHours);
});
