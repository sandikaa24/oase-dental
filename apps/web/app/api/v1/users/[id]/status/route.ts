import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { userStatusSchema } from '@/lib/validations/user.schema';
import { setUserStatus } from '@/lib/services/user.service';

/**
 * PATCH /api/v1/users/:id/status
 * Aktifkan atau nonaktifkan user.
 * OWNER tidak bisa menonaktifkan diri sendiri (U3) — service akan 400.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const { active } = userStatusSchema.parse(body);
    const ip = getClientIp(req);

    const user = await setUserStatus(params.id, active, auth.userId, ip);
    return ok(user);
  }
);
