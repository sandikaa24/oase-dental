import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateUserSchema } from '@/lib/validations/user.schema';
import { getUserById, updateUser } from '@/lib/services/user.service';

/**
 * GET /api/v1/users/:id
 * Detail user.
 * Permission: [OWNER]
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const user = await getUserById(params.id);
    return ok(user);
  }
);

/**
 * PATCH /api/v1/users/:id
 * Update user (partial: email, role, employeeId).
 * Perubahan role ke/dari OWNER dilarang (keputusan U2) — service akan 400.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const input = updateUserSchema.parse(body);
    const ip = getClientIp(req);

    const user = await updateUser(params.id, input, auth.userId, ip);
    return ok(user);
  }
);
