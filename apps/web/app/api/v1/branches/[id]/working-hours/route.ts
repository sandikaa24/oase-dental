import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { workingHoursSchema } from '@/lib/validations/branch.schema';
import { upsertWorkingHours } from '@/lib/services/branch.service';

/**
 * PATCH /api/v1/branches/:id/working-hours
 * Upsert working hours.
 * Permission: [OWNER]
 */
export const PATCH = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const auth = await requireAuth();
  requireRole(auth, 'OWNER');

  const body = await req.json();
  const input = workingHoursSchema.parse(body);

  const workingHours = await upsertWorkingHours(params.id, input);
  return ok(workingHours);
});
