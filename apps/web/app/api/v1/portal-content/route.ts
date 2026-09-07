import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import {
  createPortalContentSchema,
  listPortalContentQuerySchema,
} from '@/lib/validations/portal-content.schema';
import {
  createPortalContent,
  listPortalContents,
} from '@/lib/services/portal-content.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/portal-content
 * Permission: PORTAL_CONTENT_MANAGE (OWNER, MANAGER)
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.PORTAL_CONTENT_MANAGE);

  const { searchParams } = new URL(req.url);
  const query = listPortalContentQuerySchema.parse(
    Object.fromEntries(searchParams.entries())
  );

  const result = await listPortalContents(query, false);
  return ok(result.items, result.pagination);
});

/**
 * POST /api/v1/portal-content
 * Permission: PORTAL_CONTENT_MANAGE (OWNER, MANAGER)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.PORTAL_CONTENT_MANAGE);

  const body = await req.json();
  const input = createPortalContentSchema.parse(body);

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() || '127.0.0.1' : '127.0.0.1';
  const content = await createPortalContent(input, auth.userId, ip);

  const res = ok(content);
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
