import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { resetPasswordSchema } from '@/lib/validations/user.schema';
import { resetPassword } from '@/lib/services/user.service';

/**
 * PATCH /api/v1/users/:id/reset-password
 * Reset password user oleh OWNER. Tidak perlu password lama (OWNER-only).
 * Revoke semua refresh token user (sesi aktif langsung invalid).
 * Response TIDAK mengandung passwordHash.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const { newPassword } = resetPasswordSchema.parse(body);
    const ip = getClientIp(req);

    const user = await resetPassword(params.id, newPassword, auth.userId, ip);
    return ok(user);
  }
);
