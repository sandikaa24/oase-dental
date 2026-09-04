import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { withErrorHandler } from '@/lib/error-handler';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { ok } from '@/lib/response';
import { ValidationError } from '@/lib/errors';
import { uploadExpenseProof } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * POST /api/v1/uploads/expense-proof
 * Mengunggah gambar bukti nota/kuitansi pengeluaran.
 * Permission: EXPENSE_CREATE (OWNER, MANAGER)
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = await requireAuth();
  requirePermission(auth, 'EXPENSE_CREATE');

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new ValidationError('Format form-data tidak valid');
  }

  const file = formData.get('file');

  if (!file || !(file instanceof File) || typeof file === 'string') {
    throw new ValidationError('File bukti pengeluaran wajib diunggah');
  }

  // Validasi ukuran (maks 2MB)
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError('Ukuran file melebihi batas maksimal 2MB');
  }

  // Validasi tipe MIME (hanya gambar)
  if (!file.type || !file.type.startsWith('image/')) {
    throw new ValidationError('Format file tidak valid, hanya file gambar yang diperbolehkan');
  }

  // Generate safe filename di server
  const originalName = file.name || 'image.jpg';
  const parts = originalName.split('.');
  const rawExt = parts.length > 1 ? parts.pop()! : '';
  const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  const fileName = `expense-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;

  // Baca buffer & upload ke Supabase Storage
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const url = await uploadExpenseProof(fileBuffer, fileName, file.type);

  const res = ok({ url });
  return NextResponse.json(await res.json(), { status: 201, headers: res.headers });
});
