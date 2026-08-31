import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, getClientIp } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { cancelTransactionSchema } from '@/lib/validations/pos.schema';
import { cancelTransaction } from '@/lib/services/pos.service';

/**
 * POST /api/v1/transactions/:id/cancel
 * Cancel Transaksi PAID
 * Permission: [OWNER] (TRANSACTION_CANCEL)
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER');

    const body = await req.json();
    const input = cancelTransactionSchema.parse(body);
    const ip = getClientIp(req);

    const transaction = await cancelTransaction(
      params.id,
      input.reason,
      auth.userId,
      ip
    );

    return ok(transaction);
  }
);
