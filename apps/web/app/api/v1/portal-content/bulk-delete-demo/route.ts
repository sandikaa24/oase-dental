import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { bulkDeleteDemoSchema } from '@/lib/validations/portal-content.schema';
import { bulkDeleteDemoContent } from '@/lib/services/portal-content.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/portal-content/bulk-delete-demo
 * Menghapus semua konten bertanda isDemoContent: true
 * Permission: OWNER only
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  let body = {};
  try {
    body = await req.json();
  } catch {
    // Body kosong diperbolehkan (menghapus semua tipe demo)
  }

  const input = bulkDeleteDemoSchema.parse(body);
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() || '127.0.0.1' : '127.0.0.1';

  const result = await bulkDeleteDemoContent(input.type, auth.userId, ip);
  return ok(result);
});
