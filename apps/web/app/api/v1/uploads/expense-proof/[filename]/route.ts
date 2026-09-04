import fs from 'fs';
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { getExpenseProofPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/uploads/expense-proof/[filename]
 * Menyajikan file bukti kuitansi/nota pengeluaran.
 * Keamanan:
 * - Wajib terotentikasi (JWT)
 * - Wajib memiliki permission EXPENSE_REPORT (OWNER, MANAGER)
 * - Anti path traversal di dalam getExpenseProofPath
 */
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { filename: string } }) => {
    const auth = await requireAuth();
    requirePermission(auth, 'EXPENSE_REPORT');

    const { filePath, mimeType } = getExpenseProofPath(params.filename);
    const fileBuffer = await fs.promises.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }
);
