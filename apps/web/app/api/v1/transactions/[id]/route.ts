import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requireRole, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { updateTransactionSchema } from '@/lib/validations/pos.schema';
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
} from '@/lib/services/pos.service';

/**
 * GET /api/v1/transactions/:id
 * Detail transaksi + IDOR guard
 * Role: [OWNER, CASHIER]
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requireRole(auth, 'OWNER', 'CASHIER');

    const transaction = await getTransactionById(
      params.id,
      auth.role,
      auth.branchId
    );

    return ok(transaction);
  }
);

/**
 * PATCH /api/v1/transactions/:id
 * Edit DRAFT transaksi saja
 * Permission: POS_CREATE (OWNER, CASHIER)
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'POS_CREATE');

    const body = await req.json();
    const input = updateTransactionSchema.parse(body);

    const transaction = await updateTransaction(
      params.id,
      input,
      auth.role,
      auth.branchId
    );

    return ok(transaction);
  }
);

/**
 * DELETE /api/v1/transactions/:id
 * Buang DRAFT transaksi
 * Permission: POS_CREATE (OWNER, CASHIER)
 */
export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'POS_CREATE');

    const result = await deleteTransaction(
      params.id,
      auth.role,
      auth.branchId
    );

    return ok(result);
  }
);
