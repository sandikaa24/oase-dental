import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { ok } from '@/lib/response';
import { listPortalContentQuerySchema } from '@/lib/validations/portal-content.schema';
import { listPortalContents } from '@/lib/services/portal-content.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portal-content/public
 * Endpoint publik (tanpa autentikasi)
 * Otomatis memfilter published: true dan patientConsent: true untuk BEFORE_AFTER.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const query = listPortalContentQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const result = await listPortalContents(query, true);
  return ok(result.items, result.pagination);
});
