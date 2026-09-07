import { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { Permission } from '@oase/shared';
import { updatePortalContentSchema } from '@/lib/validations/portal-content.schema';
import {
  deletePortalContent,
  getPortalContentById,
  updatePortalContent,
} from '@/lib/services/portal-content.service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/v1/portal-content/:id
 * Permission: PORTAL_CONTENT_MANAGE
 */
export const GET = withErrorHandler(async (_req: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.PORTAL_CONTENT_MANAGE);

  const content = await getPortalContentById(params.id);
  return ok(content);
});

/**
 * PATCH /api/v1/portal-content/:id
 * Permission: PORTAL_CONTENT_MANAGE
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.PORTAL_CONTENT_MANAGE);

  const body = await req.json();
  const input = updatePortalContentSchema.parse(body);

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() || '127.0.0.1' : '127.0.0.1';
  const updated = await updatePortalContent(params.id, input, auth.userId, ip);
  return ok(updated);
});

/**
 * DELETE /api/v1/portal-content/:id
 * Permission: PORTAL_CONTENT_MANAGE
 */
export const DELETE = withErrorHandler(async (req: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth();
  requirePermission(auth, Permission.PORTAL_CONTENT_MANAGE);

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() || '127.0.0.1' : '127.0.0.1';
  const result = await deletePortalContent(params.id, auth.userId, ip);

  return ok(result);
});
